export interface SessionStats {
  audioInputTokens: number;
  textInputTokens: number;
  cachedInputTokens: number;
  audioOutputTokens: number;
  textOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface UsageEvent {
  type: string;
  response?: {
    usage?: {
      input_token_details: {
        audio_tokens: number;
        text_tokens: number;
        cached_tokens: number;
        cached_tokens_details: {
          audio_tokens: number;
          text_tokens: number;
        };
      };
      output_token_details: {
        audio_tokens: number;
        text_tokens: number;
      };
    };
  };
  [key: string]: any;
}

export interface PricingConfig {
  audioInputCost: number;
  audioOutputCost: number;
  cachedAudioCost: number;
  textInputCost: number;
  textOutputCost: number;
}

export function calculateCosts(
  stats: Omit<SessionStats, 'inputCost' | 'outputCost' | 'totalCost'>,
  pricing: PricingConfig
): Pick<SessionStats, 'inputCost' | 'outputCost' | 'totalCost'> {
  const audioInputCost = stats.audioInputTokens * pricing.audioInputCost;
  const cachedInputCost = stats.cachedInputTokens * pricing.cachedAudioCost;
  const textInputCost = stats.textInputTokens * pricing.textInputCost;
  const audioOutputCost = stats.audioOutputTokens * pricing.audioOutputCost;
  const textOutputCost = stats.textOutputTokens * pricing.textOutputCost;

  const inputCost = audioInputCost + cachedInputCost + textInputCost;
  const outputCost = audioOutputCost + textOutputCost;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
}

export async function createRealtimeSession(
  inStream: MediaStream,
  token: string,
  voice: string,
  model: string,
  instructions: string,
  onMessage: (data: any) => void,
  supabaseToken: string,
  knowledgeBaseId?: string,
  textOnly: boolean = false,
  realtimeSettings?: any,
  searchEnabled: boolean = true
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  const pc = new RTCPeerConnection();

  // Connection state logging (helps debug "no audio" situations)
  pc.onconnectionstatechange = () => {
    console.log('🔗 pc.connectionState:', pc.connectionState);
  };
  pc.oniceconnectionstatechange = () => {
    console.log('🧊 pc.iceConnectionState:', pc.iceConnectionState);
  };
  pc.onsignalingstatechange = () => {
    console.log('📡 pc.signalingState:', pc.signalingState);
  };

  // Only play audio output in voice mode
  let audioElement: HTMLAudioElement | null = null;

  if (!textOnly) {
    // "Unlock" audio playback as early as possible (while we’re still in the user gesture)
    audioElement = new Audio();
    audioElement.autoplay = true;
    audioElement.muted = true; // start muted to avoid any autoplay restrictions
    audioElement.volume = 1;

    // iOS/Safari friendliness
    (audioElement as any).playsInline = true;
    audioElement.setAttribute('playsinline', 'true');

    // Keep it out of the layout but still "playable" across browsers
    audioElement.style.position = 'fixed';
    audioElement.style.left = '-9999px';
    audioElement.style.top = '0';
    audioElement.style.width = '1px';
    audioElement.style.height = '1px';
    audioElement.style.opacity = '0';
    audioElement.style.pointerEvents = 'none';

    audioElement.srcObject = new MediaStream();
    if (document.body && !audioElement.isConnected) {
      document.body.appendChild(audioElement);
    }

    audioElement.play().catch((err) => {
      console.warn('⚠️ Audio unlock play() blocked:', err);
    });

    pc.ontrack = (e) => {
      console.log('🔊 Audio track received from OpenAI', {
        streams: e.streams?.length ?? 0,
        trackKind: e.track?.kind,
        trackId: e.track?.id,
      });

      if (e.track?.kind !== 'audio') return;

      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElement.muted = true;
        audioElement.volume = 1;

        (audioElement as any).playsInline = true;
        audioElement.setAttribute('playsinline', 'true');

        audioElement.style.position = 'fixed';
        audioElement.style.left = '-9999px';
        audioElement.style.top = '0';
        audioElement.style.width = '1px';
        audioElement.style.height = '1px';
        audioElement.style.opacity = '0';
        audioElement.style.pointerEvents = 'none';
      }

      // Some browsers may not populate `e.streams`; fall back to a stream from the track.
      const stream = e.streams?.[0] ?? new MediaStream([e.track]);
      audioElement.srcObject = stream;
      audioElement.muted = false;

      if (document.body && !audioElement.isConnected) {
        document.body.appendChild(audioElement);
      }

      const playPromise = audioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('✅ Audio playback started successfully');
          })
          .catch((error) => {
            console.error('❌ Audio playback failed:', error);
            console.log('Audio may require user interaction to play');
          });
      }
    };
  }

  // Always add input track (silent in chat mode)
  pc.addTrack(inStream.getTracks()[0]);

  const dc = pc.createDataChannel('oai-events');
  
  let sessionCreated = false;
  
  dc.addEventListener('message', (e) => {
    try {
      const eventData = JSON.parse(e.data);
      
      // Log ALL events to debug issues
      console.log('🔔 EVENT:', eventData.type);
      
      // Log full details for critical events
      if (eventData.type?.includes('transcription') || 
          eventData.type?.includes('conversation.item') ||
          eventData.type === 'session.updated') {
        console.log('📝 Full Event Data:', JSON.stringify(eventData, null, 2));
      }
      
      // Log response events for debugging
      if (eventData.type === 'response.created') {
        console.log('🚀 Response started:', eventData.response?.id);
      }
      if (eventData.type === 'response.audio.delta') {
        console.log('🔊 Audio delta received, length:', eventData.delta?.length || 0);
      }
      if (eventData.type === 'response.audio.done') {
        console.log('✅ Audio response complete');
      }
      if (eventData.type === 'response.done') {
        console.log('📨 Response done:', {
          status: eventData.response?.status,
          reason: eventData.response?.status_details?.reason,
          outputTokens: eventData.response?.usage?.output_tokens
        });
      }
      
      // Confirm session was updated by OpenAI
      if (eventData.type === 'session.updated') {
        console.log('✅ OpenAI confirmed session update');
        console.log('Session config:', {
          modalities: eventData.session?.modalities,
          voice: eventData.session?.voice,
          input_audio_transcription: eventData.session?.input_audio_transcription,
          turn_detection: eventData.session?.turn_detection?.type
        });
      }
      
      // Send session.update with instructions after receiving session.created
      if (eventData.type === 'session.created' && !sessionCreated) {
        sessionCreated = true;
        console.log('✅ Session created, sending configuration update...');

        const defaultTurnDetection = textOnly
          ? null
          : {
              type: 'server_vad',
              // Higher threshold reduces accidental interruptions from background noise.
              threshold: 0.65,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000,
              // Ensure the assistant responds automatically after speech stops.
              create_response: true,
              // Prevent assistant audio from being cancelled by brief mic noise.
              interrupt_response: false,
            };

        const baseModalities: Array<'text' | 'audio'> =
          realtimeSettings?.modalities ?? (textOnly ? ['text'] : ['audio', 'text']);

        // In voice mode, always include audio so we don't accidentally disable output audio
        const normalizedModalities = textOnly
          ? baseModalities
          : (Array.from(new Set([...baseModalities, 'audio'])) as Array<'text' | 'audio'>);

        const normalizeTurnDetection = (td: any) => {
          if (textOnly) return null;
          if (!td) return defaultTurnDetection;
          if (typeof td !== 'object') return defaultTurnDetection;
          if (td.type === 'none') return null;

          // Accept both camelCase (UI) and snake_case (API)
          const prefixPaddingMs = td.prefix_padding_ms ?? td.prefixPaddingMs ?? 300;
          const silenceDurationMs = td.silence_duration_ms ?? td.silenceDurationMs ?? 1000;

          return {
            type: 'server_vad',
            threshold: td.threshold ?? 0.65,
            prefix_padding_ms: prefixPaddingMs,
            silence_duration_ms: silenceDurationMs,
            create_response: true,
            interrupt_response: false,
          };
        };

        // If VAD is disabled in UI, we still need a working voice flow.
        // Until we have a dedicated "manual push-to-talk" UX, force server VAD in voice mode.
        const normalizedTurnDetection = normalizeTurnDetection(realtimeSettings?.turnDetection);

        const sessionUpdate: any = {
          type: 'session.update',
          session: {
            instructions: instructions,
            modalities: normalizedModalities,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: normalizedTurnDetection,
            temperature: realtimeSettings?.temperature ?? 0.8,
            max_response_output_tokens: realtimeSettings?.maxOutputTokens ?? 'inf',
          },
        };

        console.log('🎛️ session.update (client) ->', {
          modalities: normalizedModalities,
          turn_detection: normalizedTurnDetection,
        });

        // CRITICAL: Always enable transcription unless explicitly disabled or in text-only mode
        if (!textOnly) {
          sessionUpdate.session.input_audio_transcription = { model: 'whisper-1' };
          console.log('✅ Input audio transcription ENABLED (Whisper-1)');
        } else {
          console.log('⚠️ Input audio transcription DISABLED (text-only mode)');
        }

        // Add tools conditionally based on settings
        sessionUpdate.session.tools = [];
        
        // Only add web search if enabled
        if (searchEnabled) {
          sessionUpdate.session.tools.push({
            type: 'function',
            name: 'web_search',
            description: 'Search the web for current information, news, or any real-time data. Use this when you need up-to-date information beyond your training cutoff or when the user asks about current events.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to look up on the web'
                }
              },
              required: ['query']
            }
          });
        }
        
        // Add knowledge base search tool if available
        if (knowledgeBaseId) {
          sessionUpdate.session.tools.push({
            type: 'function',
            name: 'search_knowledge_base',
            description: 'Search the knowledge base for relevant information. Use this when the user asks questions that might be answered by documents in the knowledge base.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to find relevant information'
                }
              },
              required: ['query']
            }
          });
        }
        
        sessionUpdate.session.tool_choice = 'auto';
        
        console.log('📤 Sending session update:', JSON.stringify(sessionUpdate, null, 2));
        dc.send(JSON.stringify(sessionUpdate));
        console.log('Session updated with voice:', voice, 'and instructions:', instructions, 'KB:', knowledgeBaseId);
      }
      
      // Handle function calls from the AI
      if (eventData.type === 'response.function_call_arguments.done') {
        const callId = eventData.call_id;
        const functionName = eventData.name;
        const args = JSON.parse(eventData.arguments);

        // In voice mode we use server VAD, so we should NOT force extra responses.
        // Manually creating responses here causes duplicate assistant outputs.
        const shouldManuallyCreateResponse = !!textOnly;

        if (functionName === 'web_search') {
          console.log('AI requesting web search:', args.query);
          console.log('Using Supabase token:', supabaseToken ? 'Token present' : 'NO TOKEN');

          // Store the search request in an event for display
          onMessage({
            type: 'web_search.request',
            call_id: callId,
            query: args.query,
            timestamp: new Date().toISOString()
          });

          if (!supabaseToken) {
            console.error('Missing Supabase token for web search');
            const functionOutput = {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({ error: 'Authentication token not available' })
              }
            };
            dc.send(JSON.stringify(functionOutput));
            if (shouldManuallyCreateResponse) {
              dc.send(JSON.stringify({ type: 'response.create' }));
            }
            return;
          }

          // Call the web-search edge function
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseToken}`
            },
            body: JSON.stringify({
              query: args.query
            })
          })
            .then(res => res.json())
            .then(data => {
              console.log('Web search results:', data.results);

              // Store the search results in an event for display
              onMessage({
                type: 'web_search.results',
                call_id: callId,
                query: args.query,
                results: data.results || [],
                answer_box: data.answer_box || null,
                timestamp: new Date().toISOString()
              });

              // Format search results for the AI
              const searchContext = `Web Search Results for "${data.query}":\n\n` +
                (data.answer_box ? `Direct Answer: ${data.answer_box.answer}\n\n` : '') +
                (data.results || []).map((r: any, i: number) =>
                  `${i + 1}. ${r.title}\n   ${r.snippet}\n   Link: ${r.link}`
                ).join('\n\n');

              // Send the search results back to the AI
              const functionOutput = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: searchContext
                }
              };

              dc.send(JSON.stringify(functionOutput));

              // Only needed in text-only mode
              if (shouldManuallyCreateResponse) {
                dc.send(JSON.stringify({ type: 'response.create' }));
              }
            })
            .catch(err => {
              console.error('Error performing web search:', err);

              // Send error back to AI
              const functionOutput = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({ error: 'Failed to perform web search' })
                }
              };

              dc.send(JSON.stringify(functionOutput));
              if (shouldManuallyCreateResponse) {
                dc.send(JSON.stringify({ type: 'response.create' }));
              }
            });
        } else if (functionName === 'search_knowledge_base' && knowledgeBaseId) {
          console.log('AI requesting knowledge base search:', args.query);

          // Call the search-knowledge function
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-knowledge`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseToken}`
            },
            body: JSON.stringify({
              query: args.query,
              knowledge_base_id: knowledgeBaseId
            })
          })
            .then(res => res.json())
            .then(data => {
              console.log('Knowledge base search results:', data.results);

              // Store the knowledge results in an event for display
              onMessage({
                type: 'knowledge_base.search_results',
                call_id: callId,
                query: args.query,
                results: data.results || [],
                timestamp: new Date().toISOString()
              });

              // Send the search results back to the AI
              const functionOutput = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify(data.results || [])
                }
              };

              dc.send(JSON.stringify(functionOutput));

              if (shouldManuallyCreateResponse) {
                dc.send(JSON.stringify({ type: 'response.create' }));
              }
            })
            .catch(err => {
              console.error('Error searching knowledge base:', err);

              // Send error back to AI
              const functionOutput = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({ error: 'Failed to search knowledge base' })
                }
              };

              dc.send(JSON.stringify(functionOutput));
              if (shouldManuallyCreateResponse) {
                dc.send(JSON.stringify({ type: 'response.create' }));
              }
            });
        }
      }

      // STRUCTURAL SENTIMENT ANALYSIS: Trigger on transcription completion
      if (eventData.type === 'conversation.item.input_audio_transcription.completed' ||
          eventData.type === 'conversation.item.input_audio_transcription.done') {
        const transcript = eventData.transcript;
        const itemId = eventData.item_id;
        
        if (transcript && transcript.trim().length > 0) {
          console.log('🎯 Triggering structural sentiment analysis for item:', itemId);
          
          // Call client-side sentiment analysis edge function
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-sentiment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseToken}`
            },
            body: JSON.stringify({
              text: transcript,
              item_id: itemId
            })
          })
            .then(res => res.json())
            .then(data => {
              console.log('✅ Sentiment analysis result:', data);
              
              // Emit sentiment event with item_id for correlation
              onMessage({
                type: 'sentiment.detected',
                item_id: itemId,
                sentiment: data.sentiment,
                confidence: data.confidence,
                reason: data.reason,
                timestamp: new Date().toISOString()
              });
            })
            .catch(err => {
              console.error('Sentiment analysis failed:', err);
            });
        }
      }

      onMessage(eventData);
    } catch (err) {
      console.error('Error parsing event data:', err);
    }
  });

  const waitForIceGatheringComplete = (timeoutMs = 3000) =>
    new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve();

      const onStateChange = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', onStateChange);
          clearTimeout(timeout);
          resolve();
        }
      };

      const timeout = window.setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        console.warn('⚠️ ICE gathering timed out; continuing with current SDP');
        resolve();
      }, timeoutMs);

      pc.addEventListener('icegatheringstatechange', onStateChange);
    });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete();

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/sdp',
  };

  const opts = {
    method: 'POST',
    body: pc.localDescription?.sdp ?? offer.sdp,
    headers,
  };

  const resp = await fetch(
    `https://api.openai.com/v1/realtime?model=${model}`,
    opts
  );

  if (!resp.ok) {
    throw new Error(`Failed to establish session: ${resp.statusText}`);
  }

  await pc.setRemoteDescription({
    type: 'answer',
    sdp: await resp.text(),
  });

  return { pc, dc };
}

export class AudioVisualizer {
  private audioContext: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  private animationFrame: number | null = null;
  private onActivity: (active: boolean) => void;

  constructor(onActivity: (active: boolean) => void) {
    this.onActivity = onActivity;
  }

  setup(stream: MediaStream) {
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyzer = this.audioContext.createAnalyser();
    this.analyzer.fftSize = 256;

    source.connect(this.analyzer);

    this.startVisualization();
  }

  private startVisualization() {
    if (!this.analyzer) return;

    const bufferLength = this.analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      if (!this.analyzer) return;

      this.analyzer.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;

      this.onActivity(average > 30);
      this.animationFrame = requestAnimationFrame(update);
    };

    update();
  }

  cleanup() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyzer = null;
  }
}
