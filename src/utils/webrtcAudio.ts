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

export interface ValidationConfig {
  enabled: boolean;
  rules: string;
  delayMs: number;
  standardMessage: string;
}

export type FirstSpeaker = 'ai' | 'human';

export interface FirstSpeakerConfig {
  speaker: FirstSpeaker;
  aiGreetingMessage?: string;
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
  searchEnabled: boolean = true,
  validationConfig?: ValidationConfig,
  firstSpeakerConfig: FirstSpeakerConfig = { speaker: 'human' }
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

  // Audio validation state
  let currentTranscript = '';
  let audioContext: AudioContext | null = null;
  let delayNode: DelayNode | null = null;
  let gainNode: GainNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let audioStream: MediaStream | null = null; // Store stream for reconnection
  const validationDelayMs = validationConfig?.delayMs ?? 500;

  // Reference to data channel for validation trigger
  let dataChannelRef: RTCDataChannel | null = null;

  // Function to reconnect audio source after validation failure
  const reconnectAudioSource = () => {
    if (!audioContext || !delayNode || !audioStream) return;
    
    try {
      // Disconnect existing source if any
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch (e) { /* ignore */ }
      }
      
      // Create new source from stored stream
      sourceNode = audioContext.createMediaStreamSource(audioStream);
      sourceNode.connect(delayNode);
      console.log('🔄 Audio source reconnected');
    } catch (e) {
      console.error('Failed to reconnect audio source:', e);
    }
  };

  // Function to handle validation failure - injects trigger to model
  const handleValidationFailure = (reason: string) => {
    console.log('🚨 Validation failed - triggering model rephrase...');
    
    // 1. Immediately mute buffered audio (don't disconnect, just mute!)
    if (gainNode && audioContext) {
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      console.log('🔇 Audio muted due to validation failure');
    }
    
    // 2. Cancel any ongoing response first
    if (dataChannelRef && dataChannelRef.readyState === 'open') {
      console.log('🛑 Cancelling current response...');
      dataChannelRef.send(JSON.stringify({ type: 'response.cancel' }));
    }
    
    // 3. Small delay to ensure cancel is processed, then send trigger
    setTimeout(() => {
      if (dataChannelRef && dataChannelRef.readyState === 'open') {
        const triggerMessage = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '[VALIDATION_FAILED]'
              }
            ]
          }
        };
        
        console.log('📤 Sending validation trigger to model...');
        dataChannelRef.send(JSON.stringify(triggerMessage));
        
        // 4. Request new response from model
        setTimeout(() => {
          if (dataChannelRef && dataChannelRef.readyState === 'open') {
            dataChannelRef.send(JSON.stringify({ type: 'response.create' }));
            console.log('📤 Requested new response from model');
          }
        }, 100);
      }
    }, 100);
    
    onMessage({
      type: 'validation.failed',
      message: `Validation failed: ${reason}. Model instructed to rephrase.`,
      timestamp: new Date().toISOString()
    });
  };

  // Function to validate transcript
  const validateTranscript = async (transcript: string): Promise<{ valid: boolean; reason: string }> => {
    if (!validationConfig?.enabled || !transcript.trim()) return { valid: true, reason: '' };
    console.log('🔍 Validating transcript:', transcript.substring(0, 100) + '...');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseToken}`
        },
        body: JSON.stringify({ transcript, validationRules: validationConfig.rules })
      });
      const result = await response.json();
      console.log('✅ Validation result:', result);
      onMessage({
        type: 'validation.result',
        valid: result.valid,
        reason: result.reason,
        transcript: transcript.substring(0, 100),
        timestamp: new Date().toISOString()
      });
      return { valid: result.valid, reason: result.reason || 'Validation failed' };
    } catch (error) {
      console.error('Validation error:', error);
      return { valid: true, reason: '' }; // Fail open
    }
  };

  // Only play audio output in voice mode
  let audioElement: HTMLAudioElement | null = null;

  if (!textOnly) {
    // Create AudioContext for delayed playback with validation
    audioContext = new AudioContext({ sampleRate: 24000 });
    delayNode = audioContext.createDelay(2.0);
    delayNode.delayTime.value = validationConfig?.enabled ? validationDelayMs / 1000 : 0;
    gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;
    delayNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    console.log(`🔊 Audio delay set to ${validationConfig?.enabled ? validationDelayMs : 0}ms for validation`);

    // "Unlock" audio playback as early as possible (while we're still in the user gesture)
    audioElement = new Audio();
    audioElement.autoplay = true;
    audioElement.muted = true; // Keep muted - we use AudioContext for output
    audioElement.volume = 0;

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

      // Route through AudioContext with delay for validation
      const stream = e.streams?.[0] ?? new MediaStream([e.track]);
      audioStream = stream; // Store for potential reconnection
      
      if (audioContext && delayNode) {
        // Resume AudioContext if suspended
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        
        sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(delayNode);
        console.log('✅ Audio routed through delay node for validation');
      }

      // Keep muted reference on audio element for browser compatibility
      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElement.muted = true;
        audioElement.volume = 0;

        (audioElement as any).playsInline = true;
        audioElement.setAttribute('playsinline', 'true');

        audioElement.style.position = 'fixed';
        audioElement.style.left = '-9999px';
      }

      audioElement.srcObject = stream;
      
      if (document.body && !audioElement.isConnected) {
        document.body.appendChild(audioElement);
      }

      audioElement.play().catch((error) => {
        console.error('❌ Audio element play failed:', error);
      });
    };
  }

  // Always add input track (silent in chat mode)
  pc.addTrack(inStream.getTracks()[0]);

  const dc = pc.createDataChannel('oai-events');
  dataChannelRef = dc; // Store reference for validation trigger

  dc.addEventListener('open', () => {
    console.log('✅ DataChannel open:', dc.label);
  });
  dc.addEventListener('close', () => {
    console.log('🛑 DataChannel closed:', dc.label);
  });
  dc.addEventListener('error', (err) => {
    console.error('❌ DataChannel error:', err);
  });

  let sessionCreated = false;
  let aiGreetingSent = false; // Track if we've already sent the AI greeting
  
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
        // Reset transcript accumulator for new response
        currentTranscript = '';
        // Ensure audio is enabled and reconnected for new response
        if (gainNode && audioContext) {
          gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
          console.log('🔊 Audio gain restored to 1.0');
        }
        // Reconnect audio source in case it was disconnected
        reconnectAudioSource();
      }
      
      // Accumulate transcript for validation
      if (eventData.type === 'response.audio_transcript.delta') {
        currentTranscript += eventData.delta || '';
        console.log('📝 Transcript accumulating:', currentTranscript.length, 'chars');
      }
      
      if (eventData.type === 'response.audio.delta') {
        console.log('🔊 Audio delta received, length:', eventData.delta?.length || 0);
      }
      if (eventData.type === 'response.audio.done') {
        console.log('✅ Audio response complete');
      }
      
      // Validate transcript when response is done
      if (eventData.type === 'response.done') {
        console.log('📨 Response done:', {
          status: eventData.response?.status,
          reason: eventData.response?.status_details?.reason,
          outputTokens: eventData.response?.usage?.output_tokens
        });
        
        // Trigger validation if enabled and we have transcript
        if (validationConfig?.enabled && currentTranscript.trim()) {
          console.log('🔍 Triggering transcript validation...');
          validateTranscript(currentTranscript).then(result => {
            if (!result.valid) {
              console.log('❌ Validation failed - triggering model rephrase');
              handleValidationFailure(result.reason);
            } else {
              console.log('✅ Validation passed - audio continues');
              // Re-enable audio gain if it was muted
              if (gainNode && audioContext) {
                gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
              }
            }
          }).catch(error => {
            console.error('❌ Unexpected error during transcript validation:', error);
            // Continue audio playback on error (fail open)
            if (gainNode && audioContext) {
              gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
            }
          });
        }
        
        // Reset transcript for next response
        currentTranscript = '';
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
        
        // If AI speaks first, trigger initial greeting ONCE after session is configured
        if (firstSpeakerConfig.speaker === 'ai' && !textOnly && !aiGreetingSent) {
          aiGreetingSent = true; // Prevent duplicate greetings
          console.log('🎤 AI speaks first - triggering initial greeting (one-time)...');
          
          // Immediately request a response - the greeting is already in the instructions
          if (dc.readyState === 'open') {
            dc.send(JSON.stringify({ type: 'response.create' }));
            console.log('📤 Sent response.create for AI greeting');
          }
        }
      }
      
      // Send session.update with instructions after receiving session.created
      if (eventData.type === 'session.created' && !sessionCreated) {
        sessionCreated = true;
        console.log('✅ Session created, sending configuration update...');

        const defaultTurnDetection = textOnly
          ? null
          : {
              type: 'server_vad',
              threshold: 0.65,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000,
              create_response: true,
              interrupt_response: false,
            };

        const baseModalities: Array<'text' | 'audio'> =
          realtimeSettings?.modalities ?? (textOnly ? ['text'] : ['audio', 'text']);

        const normalizedModalities = textOnly
          ? baseModalities
          : (Array.from(new Set([...baseModalities, 'audio', 'text'])) as Array<'text' | 'audio'>);

        const normalizeTurnDetection = (td: any) => {
          if (textOnly) return null;
          if (!td) return defaultTurnDetection;
          if (typeof td !== 'object') return defaultTurnDetection;
          if (td.type === 'none') return defaultTurnDetection;

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

        const normalizedTurnDetection = normalizeTurnDetection(realtimeSettings?.turnDetection);

        // Build instructions with validation awareness and AI greeting
        let finalInstructions = instructions;
        
        // Add AI greeting instruction if AI speaks first
        if (firstSpeakerConfig.speaker === 'ai' && firstSpeakerConfig.aiGreetingMessage) {
          const greetingAddendum = `

IMPORTANT: You MUST start this conversation immediately with this greeting: "${firstSpeakerConfig.aiGreetingMessage}"
Do not wait for the user to speak first. Begin the conversation with this greeting.`;
          finalInstructions = finalInstructions + greetingAddendum;
          console.log('👋 AI greeting instruction added to instructions');
        }
        
        if (validationConfig?.enabled) {
          const validationAddendum = `

CRITICAL VALIDATION SYSTEM:
Your responses are being validated externally against compliance rules. If you ever receive the exact message "[VALIDATION_FAILED]" from the user, it means your previous response violated a rule and was blocked. You MUST:
1. Immediately acknowledge that you need to rephrase your previous response
2. Use this standard message as a template: "${validationConfig.standardMessage}"
3. Then provide an appropriate, compliant alternative response
4. Continue the conversation naturally, maintaining high awareness not to repeat the violation

Remember: The validation system is protecting the user and the business. Take it seriously.`;
          finalInstructions = finalInstructions + validationAddendum;
          console.log('🛡️ Validation awareness added to instructions');
        }

        const sessionUpdate: any = {
          type: 'session.update',
          session: {
            instructions: finalInstructions,
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

        if (!textOnly) {
          sessionUpdate.session.input_audio_transcription = { model: 'whisper-1' };
          console.log('✅ Input audio transcription ENABLED (Whisper-1)');
        } else {
          console.log('⚠️ Input audio transcription DISABLED (text-only mode)');
        }

        sessionUpdate.session.tools = [];
        
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

        if (functionName === 'web_search') {
          console.log('AI requesting web search:', args.query);
          console.log('Using Supabase token:', supabaseToken ? 'Token present' : 'NO TOKEN');

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
            dc.send(JSON.stringify({ type: 'response.create' }));
            return;
          }

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

              onMessage({
                type: 'web_search.results',
                call_id: callId,
                query: args.query,
                results: data.results || [],
                answer_box: data.answer_box || null,
                timestamp: new Date().toISOString()
              });

              const searchContext = `Web Search Results for "${data.query}":\n\n` +
                (data.answer_box ? `Direct Answer: ${data.answer_box.answer}\n\n` : '') +
                (data.results || []).map((r: any, i: number) =>
                  `${i + 1}. ${r.title}\n   ${r.snippet}\n   Link: ${r.link}`
                ).join('\n\n');

              const functionOutput = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: searchContext
                }
              };

              dc.send(JSON.stringify(functionOutput));
              console.log('📢 Triggering response.create after web search results');
              dc.send(JSON.stringify({ type: 'response.create' }));
            })
            .catch(err => {
              console.error('Error performing web search:', err);

              const functionOutput = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({ error: 'Failed to perform web search' })
                }
              };

              dc.send(JSON.stringify(functionOutput));
              dc.send(JSON.stringify({ type: 'response.create' }));
            });
        } else if (functionName === 'search_knowledge_base' && knowledgeBaseId) {
          console.log('AI requesting knowledge base search:', args.query);

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

              onMessage({
                type: 'knowledge_base.search_results',
                call_id: callId,
                query: args.query,
                results: data.results || [],
                timestamp: new Date().toISOString()
              });

              const functionOutput = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify(data.results || [])
                }
              };

              dc.send(JSON.stringify(functionOutput));
              console.log('📢 Triggering response.create after knowledge base search results');
              dc.send(JSON.stringify({ type: 'response.create' }));
            })
            .catch(err => {
              console.error('Error searching knowledge base:', err);

              const functionOutput = {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: JSON.stringify({ error: 'Failed to search knowledge base' })
                }
              };

              dc.send(JSON.stringify(functionOutput));
              dc.send(JSON.stringify({ type: 'response.create' }));
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
