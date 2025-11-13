import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { TimelineSegment } from '@/components/ConversationTimeline';
import { TokenDataPoint } from '@/components/TokenDashboard';
import HeaderMenu from '@/components/HeaderMenu';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { VoiceModelView } from '@/components/views/VoiceModelView';
import { SystemPromptView } from '@/components/views/SystemPromptView';
import { KnowledgeBaseView } from '@/components/views/KnowledgeBaseView';
import { SearchSettingsView } from '@/components/views/SearchSettingsView';
import { SessionView } from '@/components/views/SessionView';
import { createRealtimeSession, AudioVisualizer, calculateCosts, SessionStats, UsageEvent, PricingConfig } from '@/utils/webrtcAudio';
import { updateSessionTone } from '@/utils/toneAdapter';
import { useToast } from '@/hooks/use-toast';
import { RealtimeModelSettings, ChatModelSettings, DEFAULT_REALTIME_SETTINGS, DEFAULT_CHAT_SETTINGS } from '@/types/modelSettings';
interface EventEntry {
  timestamp: string;
  data: any;
}
const initialStats: SessionStats = {
  audioInputTokens: 0,
  textInputTokens: 0,
  cachedInputTokens: 0,
  audioOutputTokens: 0,
  textOutputTokens: 0,
  inputCost: 0,
  outputCost: 0,
  totalCost: 0
};
export default function Index() {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'idle' | 'success' | 'error' | 'connecting'>('idle');
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [currentStats, setCurrentStats] = useState<SessionStats>(initialStats);
  const [sessionStats, setSessionStats] = useState<SessionStats>(initialStats);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioVisualizer, setAudioVisualizer] = useState<AudioVisualizer | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-realtime-preview-2024-12-17');
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [selectedChatModel, setSelectedChatModel] = useState('google/gemini-2.5-flash');
  const [botPrompt, setBotPrompt] = useState('You are a helpful AI assistant. Be concise and friendly in your responses.\n\nCRITICAL: You MUST call the detect_sentiment function after EVERY user message to analyze their emotional tone (positive, neutral, negative, or mixed). Include confidence (0-1) and a brief reason. This is essential for adapting your tone appropriately.\n\nExamples:\n- User sounds frustrated → detect_sentiment({sentiment: "negative", confidence: 0.8, reason: "User expressing frustration"})\n- User is enthusiastic → detect_sentiment({sentiment: "positive", confidence: 0.9, reason: "User showing excitement"})\n- Casual conversation → detect_sentiment({sentiment: "neutral", confidence: 0.7, reason: "Casual, relaxed tone"})');
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | undefined>(undefined);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    audioInputCost: 0.00004,
    audioOutputCost: 0.00008,
    cachedAudioCost: 0.0000025,
    textInputCost: 0.0000025,
    textOutputCost: 0.00001
  });
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const [timelineSegments, setTimelineSegments] = useState<TimelineSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<Partial<TimelineSegment> | null>(null);
  const [tokenDataPoints, setTokenDataPoints] = useState<TokenDataPoint[]>([]);
  const [cumulativeTokens, setCumulativeTokens] = useState({
    input: 0,
    output: 0
  });
  const [interactionMode, setInteractionMode] = useState<'voice' | 'chat'>('voice');
  
  // Auto-switch models when mode changes
  useEffect(() => {
    if (interactionMode === 'voice') {
      setSelectedModel('gpt-4o-realtime-preview-2024-12-17');
    } else {
      setSelectedModel(selectedChatModel);
    }
  }, [interactionMode, selectedChatModel]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
  }>>([]);
  const [searchService, setSearchService] = useState<'searchapi' | 'serpapi'>('searchapi');
  const [searchTypes, setSearchTypes] = useState({
    web: true,
    shopping: false,
    amazon: false,
    maps: false
  });
  
  // Sentiment and tone control states
  const [currentSentiment, setCurrentSentiment] = useState<{
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    confidence: number;
    reason?: string;
  } | null>(null);
  const [adaptiveTone, setAdaptiveTone] = useState(true);
  const [currentView, setCurrentView] = useState('session'); // Default to session view
  const [realtimeSettings, setRealtimeSettings] = useState<RealtimeModelSettings>(DEFAULT_REALTIME_SETTINGS);
  const [chatSettings, setChatSettings] = useState<ChatModelSettings>(DEFAULT_CHAT_SETTINGS);

  // Authentication check
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, authSession) => {
      setSession(authSession);
      setUser(authSession?.user ?? null);
      if (!authSession) {
        navigate('/auth');
      }
    });
    supabase.auth.getSession().then(({
      data: {
        session: authSession
      }
    }) => {
      setSession(authSession);
      setUser(authSession?.user ?? null);
      if (!authSession) {
        navigate('/auth');
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  
  // Effect to update session tone when sentiment changes (Step 2: Tone Adaptation)
  useEffect(() => {
    if (isConnected && dataChannel && currentSentiment && adaptiveTone) {
      console.log('Adapting tone based on sentiment:', currentSentiment.sentiment);
      updateSessionTone(dataChannel, botPrompt, currentSentiment.sentiment, adaptiveTone);
    }
  }, [currentSentiment, adaptiveTone, dataChannel, isConnected, botPrompt]);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };
  const addEvent = (data: any) => {
    const entry: EventEntry = {
      timestamp: new Date().toISOString(),
      data
    };
    // Store all events for the session without limiting
    setEvents(prev => [entry, ...prev]);
  };
  const handleMessage = (eventData: UsageEvent) => {
    addEvent(eventData);
    
    // Handle sentiment detection events
    if (eventData.type === 'sentiment.detected') {
      const sentimentData = {
        sentiment: eventData.sentiment,
        confidence: eventData.confidence,
        reason: eventData.reason
      };
      setCurrentSentiment(sentimentData);
      console.log('Sentiment detected:', sentimentData);
    }

    // Track timeline segments
    if (eventData.type === 'input_audio_buffer.speech_started') {
      setCurrentSegment({
        start: Date.now(),
        speaker: 'user'
      });
    } else if (eventData.type === 'input_audio_buffer.speech_stopped') {
      if (currentSegment?.start && currentSegment.speaker === 'user') {
        const end = Date.now();
        setTimelineSegments(prev => [...prev, {
          start: currentSegment.start,
          end,
          duration: end - currentSegment.start,
          speaker: 'user',
          sentiment: currentSentiment ? {
            sentiment: currentSentiment.sentiment,
            confidence: currentSentiment.confidence
          } : undefined
        }]);
        setCurrentSegment(null);
      }
    } else if (eventData.type === 'response.audio.delta') {
      if (!currentSegment || currentSegment.speaker !== 'assistant') {
        setCurrentSegment({
          start: Date.now(),
          speaker: 'assistant'
        });
      }
    } else if (eventData.type === 'response.audio.done') {
      if (currentSegment?.start && currentSegment.speaker === 'assistant') {
        const end = Date.now();
        const segment: TimelineSegment = {
          start: currentSegment.start,
          end,
          duration: end - currentSegment.start,
          speaker: 'assistant',
          inputTokens: currentSegment.inputTokens,
          outputTokens: currentSegment.outputTokens
        };
        setTimelineSegments(prev => [...prev, segment]);
        setCurrentSegment(null);
      }
    }
    if (eventData.type === 'response.done' && eventData.response?.usage) {
      console.log('=== RESPONSE.DONE EVENT ===');
      console.log('Full event:', JSON.stringify(eventData, null, 2));
      const usage = eventData.response.usage;
      console.log('Usage object:', usage);
      const inputDetails = usage.input_token_details;
      const outputDetails = usage.output_token_details;
      const cachedDetails = inputDetails.cached_tokens_details || {
        audio_tokens: 0,
        text_tokens: 0
      };
      console.log('Input details:', inputDetails);
      console.log('Output details:', outputDetails);
      console.log('Cached details:', cachedDetails);
      const newStats = {
        audioInputTokens: inputDetails.audio_tokens - cachedDetails.audio_tokens,
        textInputTokens: inputDetails.text_tokens - cachedDetails.text_tokens,
        cachedInputTokens: inputDetails.cached_tokens || 0,
        audioOutputTokens: outputDetails.audio_tokens,
        textOutputTokens: outputDetails.text_tokens
      };
      console.log('Calculated newStats:', newStats);
      const costs = calculateCosts(newStats, pricingConfig);
      const fullStats = {
        ...newStats,
        ...costs
      };
      setCurrentStats(fullStats);

      // Store token data in current segment for timeline
      const totalInput = newStats.audioInputTokens + newStats.textInputTokens;
      const totalOutput = newStats.audioOutputTokens + newStats.textOutputTokens;
      setCurrentSegment(prev => {
        if (prev && prev.speaker === 'assistant') {
          return {
            ...prev,
            inputTokens: totalInput,
            outputTokens: totalOutput
          };
        }
        return prev;
      });
      setSessionStats(prev => {
        const updated = {
          audioInputTokens: prev.audioInputTokens + newStats.audioInputTokens,
          textInputTokens: prev.textInputTokens + newStats.textInputTokens,
          cachedInputTokens: prev.cachedInputTokens + newStats.cachedInputTokens,
          audioOutputTokens: prev.audioOutputTokens + newStats.audioOutputTokens,
          textOutputTokens: prev.textOutputTokens + newStats.textOutputTokens,
          inputCost: prev.inputCost + costs.inputCost,
          outputCost: prev.outputCost + costs.outputCost,
          totalCost: prev.totalCost + costs.totalCost
        };
        console.log('Previous session stats:', prev);
        console.log('Updated session stats:', updated);
        return updated;
      });

      // Track token data points for dashboard
      console.log('Checking if should add data point. sessionStartTimeRef:', sessionStartTimeRef.current);
      if (sessionStartTimeRef.current) {
        const totalInput = newStats.audioInputTokens + newStats.textInputTokens;
        const totalOutput = newStats.audioOutputTokens + newStats.textOutputTokens;
        console.log('Adding data point - totalInput:', totalInput, 'totalOutput:', totalOutput);
        setCumulativeTokens(prev => {
          const newCumulativeInput = prev.input + totalInput;
          const newCumulativeOutput = prev.output + totalOutput;
          const dataPoint: TokenDataPoint = {
            timestamp: Date.now(),
            elapsedSeconds: (Date.now() - sessionStartTimeRef.current!) / 1000,
            inputTokens: totalInput,
            outputTokens: totalOutput,
            cumulativeInput: newCumulativeInput,
            cumulativeOutput: newCumulativeOutput
          };
          console.log('Created data point:', dataPoint);
          setTokenDataPoints(prevPoints => {
            const updated = [...prevPoints, dataPoint];
            console.log('Updated tokenDataPoints array length:', updated.length);
            return updated;
          });
          return {
            input: newCumulativeInput,
            output: newCumulativeOutput
          };
        });
      } else {
        console.log('NOT adding data point - sessionStartTimeRef is null');
      }
    }
  };
  const startSession = async (voice: string, model: string) => {
    try {
      setSelectedVoice(voice);
      setStatusType('connecting');
      if (interactionMode === 'chat') {
        // Chat mode: Just initialize session state without WebRTC
        setStatusMessage('Initializing chat session...');
        const startTime = Date.now();
        sessionStartTimeRef.current = startTime;
        setIsConnected(true);
        setSessionStartTime(startTime);
        setTokenDataPoints([]);
        setCumulativeTokens({
          input: 0,
          output: 0
        });
        setChatMessages([]);
        setStatusType('success');
        setStatusMessage('Chat session ready!');
        toast({
          title: 'Connected',
          description: 'Chat session is active'
        });
      } else {
        // Voice mode: Use Realtime API with WebRTC
        setStatusMessage('Getting session token...');
        const {
          data: tokenData,
          error: tokenError
        } = await supabase.functions.invoke('get-realtime-token', {
          body: {
            model,
            voice,
            instructions: botPrompt
          }
        });
        if (tokenError || !tokenData?.client_secret?.value) {
          throw new Error(tokenError?.message || 'Failed to get session token');
        }
        const token = tokenData.client_secret.value;
        setStatusMessage('Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
        setAudioStream(stream);
        const visualizer = new AudioVisualizer(setIsAudioActive);
        visualizer.setup(stream);
        setAudioVisualizer(visualizer);
        setStatusMessage('Establishing connection...');
        const supabaseToken = session?.access_token;
        console.log('Starting realtime session with Supabase token:', supabaseToken ? 'Present' : 'MISSING');
        if (!supabaseToken) {
          throw new Error('User session token not available. Please refresh the page.');
        }
        // Check if any search type is enabled
        const isSearchEnabled = Object.values(searchTypes).some(enabled => enabled);
        
        const {
          pc,
          dc
        } = await createRealtimeSession(
          stream, 
          token, 
          voice, 
          model, 
          botPrompt, 
          handleMessage, 
          supabaseToken, 
          knowledgeBaseId || undefined, 
          false, 
          realtimeSettings,
          isSearchEnabled
        );
        setPeerConnection(pc);
        setDataChannel(dc);
        const startTime = Date.now();
        sessionStartTimeRef.current = startTime;
        setIsConnected(true);
        setSessionStartTime(startTime);
        setTokenDataPoints([]);
        setCumulativeTokens({
          input: 0,
          output: 0
        });
        setStatusType('success');
        setStatusMessage('Voice session established successfully!');
        toast({
          title: 'Connected',
          description: 'Voice session is active'
        });
      }
    } catch (err: any) {
      setStatusType('error');
      
      // Provide helpful error messages for common issues
      let errorMessage = err.message;
      let errorTitle = 'Connection Failed';
      
      if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
        errorTitle = 'Microphone Access Denied';
        errorMessage = 'Please allow microphone access in your browser settings and try again. You may need to click the microphone icon in your address bar.';
      } else if (err.name === 'NotFoundError') {
        errorTitle = 'No Microphone Found';
        errorMessage = 'No microphone detected. Please connect a microphone and try again.';
      } else if (err.name === 'NotReadableError') {
        errorTitle = 'Microphone In Use';
        errorMessage = 'Your microphone is being used by another application. Please close other apps and try again.';
      }
      
      setStatusMessage(`Error: ${errorMessage}`);
      console.error('Session error:', err);
      stopSession();
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };
  const stopSession = async () => {
    // Auto-save session before stopping
    if (sessionStartTime && user) {
      const sessionName = `Session ${new Date().toLocaleString()}`;
      const sessionData = {
        user_id: user.id,
        name: sessionName,
        model: selectedModel,
        voice: selectedVoice,
        bot_prompt: botPrompt,
        knowledge_base_id: knowledgeBaseId || null,
        pricing_config: pricingConfig as any,
        session_stats: sessionStats as any,
        timeline_segments: timelineSegments as any,
        token_data_points: tokenDataPoints as any,
        events: events as any,
        session_start_time: sessionStartTime,
        session_end_time: Date.now(),
        duration_ms: Date.now() - sessionStartTime
      };
      const {
        error
      } = await supabase.from('sessions').insert([sessionData]);
      if (error) {
        console.error('Error auto-saving session:', error);
      } else {
        toast({
          title: 'Session Saved',
          description: 'Session data has been saved. Click "Reset All" to clear the display.'
        });
      }
    }
    
    // Close connections but KEEP data visible on screen
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    if (dataChannel) {
      dataChannel.close();
      setDataChannel(null);
    }
    if (audioVisualizer) {
      audioVisualizer.cleanup();
      setAudioVisualizer(null);
    }
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
    
    // Only stop the connection, keep all data visible
    setIsConnected(false);
    setIsAudioActive(false);
    setStatusType('idle');
    setStatusMessage('Session stopped. Data preserved.');
  };
  const sendChatMessage = async (message: string) => {
    if (!message.trim()) {
      return;
    }
    if (interactionMode === 'voice') {
      // Voice mode: use existing WebRTC data channel
      if (!dataChannel || dataChannel.readyState !== 'open') {
        toast({
          title: 'Unable to send',
          description: 'Connection not ready. Please wait or start a session.',
          variant: 'destructive'
        });
        return;
      }
      try {
        const event = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_text',
              text: message
            }]
          }
        };
        dataChannel.send(JSON.stringify(event));
        dataChannel.send(JSON.stringify({
          type: 'response.create'
        }));
        console.log('Sent text message via WebRTC:', message);
      } catch (error) {
        console.error('Error sending message:', error);
        toast({
          title: 'Send Failed',
          description: 'Failed to send message. Please try again.',
          variant: 'destructive'
        });
      }
    } else {
      // Chat mode: use Gemini/GPT-5 chat completions (no session required)
      try {
        // Add user message to chat
        const userMessage = {
          role: 'user' as const,
          content: message
        };
        setChatMessages(prev => [...prev, userMessage]);

        // Add user message to events
        addEvent({
          type: 'conversation.item.created',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_text',
              text: message
            }]
          }
        });

        // Check if any search type is enabled
        const isSearchEnabled = Object.values(searchTypes).some(enabled => enabled);
        
        // Call chat completion edge function
        const {
          data,
          error
        } = await supabase.functions.invoke('chat-completion', {
          body: {
            messages: [{
              role: 'system',
              content: botPrompt
            }, ...chatMessages, userMessage],
            model: selectedChatModel, // Use chat-specific model
            knowledgeBaseId: knowledgeBaseId,
            chatSettings: chatSettings,
            searchEnabled: isSearchEnabled
          }
        });
        if (error) throw error;
        
        // Check if AI is requesting a tool call (web search)
        if (data.requires_tool && data.tool_name === 'web_search' && data.tool_arguments) {
          console.log('AI requested web search:', data.tool_arguments);
          
          // Get the tool call ID from the response
          const toolCallId = data.choices[0]?.message?.tool_calls?.[0]?.id;
          if (!toolCallId) {
            console.error('No tool_call_id found in response');
            toast({
              title: 'Error',
              description: 'Invalid tool call response',
              variant: 'destructive'
            });
            return;
          }
          
          // Determine which search types to use
          const enabledSearchTypes = Object.entries(searchTypes)
            .filter(([_, enabled]) => enabled)
            .map(([type]) => type);
          
          // If no search type enabled or only shopping/amazon/maps, fallback to web
          const activeSearchTypes = enabledSearchTypes.length === 0 ? ['web'] : enabledSearchTypes;
          
          // Perform searches for all enabled types
          const searchPromises = activeSearchTypes.map(async (searchType) => {
            // SearchAPI only supports web search
            const serviceToUse = searchType === 'web' ? searchService : 'serpapi';
            
            const { data: searchData, error: searchError } = await supabase.functions.invoke('web-search', {
              body: { 
                query: data.tool_arguments.query,
                service: serviceToUse,
                searchType: searchType
              }
            });

            if (searchError) {
              console.error(`${searchType} search error:`, searchError);
              return null;
            }
            
            return { type: searchType, data: searchData };
          });

          const searchResults = await Promise.all(searchPromises);
          const validResults = searchResults.filter(r => r !== null);

          if (validResults.length === 0) {
            toast({
              title: 'Search Failed',
              description: 'Failed to perform web search',
              variant: 'destructive'
            });
            return;
          }

          // Format all search results
          let formattedResults = '';
          
          for (const result of validResults) {
            if (!result) continue;
            
            const { type, data: searchData } = result;
            
            if (type === 'web') {
              formattedResults += `\n\n## Web Search Results (via ${searchData.service}):\n`;
              if (searchData.answer_box) {
                formattedResults += `**Direct Answer:** ${searchData.answer_box.answer}\n\n`;
              }
              formattedResults += searchData.results?.map((r: any, i: number) => 
                `${i + 1}. **${r.title}**\n   ${r.snippet}\n   Link: ${r.link}`
              ).join('\n\n') || '';
            } else if (type === 'shopping' || type === 'amazon') {
              formattedResults += `\n\n## ${type === 'shopping' ? 'Google Shopping' : 'Amazon'} Results:\n`;
              formattedResults += searchData.shopping_results?.map((item: any, i: number) => 
                `${i + 1}. **${item.title}**\n   Price: ${item.price || 'N/A'}\n   Rating: ${item.rating || 'N/A'} (${item.reviews || 0} reviews)\n   ${item.source ? `Source: ${item.source}\n   ` : ''}Link: ${item.link}`
              ).join('\n\n') || '';
            } else if (type === 'maps') {
              formattedResults += `\n\n## Local Business Results:\n`;
              formattedResults += searchData.local_results?.map((place: any, i: number) => 
                `${i + 1}. **${place.title}**\n   ${place.address || 'Address not available'}\n   ${place.phone ? `Phone: ${place.phone}\n   ` : ''}Rating: ${place.rating || 'N/A'} (${place.reviews || 0} reviews)\n   ${place.type ? `Type: ${place.type}\n   ` : ''}${place.website ? `Website: ${place.website}` : ''}`
              ).join('\n\n') || '';
            }
          }

          // Send search results back to AI using proper tool calling format
          let currentMessages = [
            { role: 'system', content: botPrompt },
            ...chatMessages,
            userMessage,
            // Include the assistant's message with the tool call
            { 
              role: 'assistant', 
              content: '',
              tool_calls: data.choices[0].message.tool_calls
            },
            // Add the tool result
            {
              role: 'tool',
              tool_call_id: toolCallId,
              content: formattedResults
            }
          ];

          // Handle potential follow-up tool calls (like sentiment detection)
          let finalData = null;
          let attempts = 0;
          const maxAttempts = 3; // Prevent infinite loops

          while (attempts < maxAttempts) {
            const { data: responseData, error: responseError } = await supabase.functions.invoke('chat-completion', {
              body: {
                messages: currentMessages,
                model: selectedChatModel,
                knowledgeBaseId: knowledgeBaseId,
                chatSettings: chatSettings,
                searchEnabled: isSearchEnabled
              }
            });

            if (responseError) throw responseError;

            // Check if AI wants to make another tool call
            if (responseData.requires_tool && responseData.tool_name === 'detect_sentiment') {
              console.log('AI requesting sentiment detection after search');
              
              const sentimentToolCallId = responseData.choices[0]?.message?.tool_calls?.[0]?.id;
              if (!sentimentToolCallId) break;

              // Add assistant message with tool call
              currentMessages.push({
                role: 'assistant',
                content: '',
                tool_calls: responseData.choices[0].message.tool_calls
              });

              // Add tool response
              currentMessages.push({
                role: 'tool',
                tool_call_id: sentimentToolCallId,
                content: JSON.stringify({
                  acknowledged: true,
                  ...responseData.tool_arguments
                })
              });

              attempts++;
              continue; // Try again with updated messages
            }

            // We got a final response
            finalData = responseData;
            break;
          }

          if (!finalData) {
            throw new Error('Failed to get final response after tool calls');
          }

          const finalMessage = finalData.choices[0]?.message?.content;
          if (finalMessage) {
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: finalMessage
            }]);

            addEvent({
              type: 'response.done',
              response: {
                output: [{
                  type: 'message',
                  role: 'assistant',
                  content: [{
                    type: 'text',
                    text: finalMessage
                  }]
                }],
                usage: finalData.usage
              }
            });

            if (finalData.usage) {
              const usage = finalData.usage;
              const newStats = {
                audioInputTokens: 0,
                textInputTokens: usage.prompt_tokens || 0,
                cachedInputTokens: 0,
                audioOutputTokens: 0,
                textOutputTokens: usage.completion_tokens || 0
              };
              const costs = calculateCosts(newStats, pricingConfig);
              const fullStats = {
                ...newStats,
                ...costs
              };
              setCurrentStats(fullStats);
              setSessionStats(prev => ({
                audioInputTokens: prev.audioInputTokens,
                textInputTokens: prev.textInputTokens + newStats.textInputTokens,
                cachedInputTokens: prev.cachedInputTokens,
                audioOutputTokens: prev.audioOutputTokens,
                textOutputTokens: prev.textOutputTokens + newStats.textOutputTokens,
                inputCost: prev.inputCost + costs.inputCost,
                outputCost: prev.outputCost + costs.outputCost,
                totalCost: prev.totalCost + costs.totalCost
              }));
            }
          }
          return;
        }
        
        // Check if AI is requesting sentiment detection
        if (data.requires_tool && data.tool_name === 'detect_sentiment' && data.tool_arguments) {
          console.log('AI detected sentiment:', data.tool_arguments);
          
          // Get the tool call ID from the response
          const toolCallId = data.choices[0]?.message?.tool_calls?.[0]?.id;
          if (!toolCallId) {
            console.error('No tool_call_id found in response');
            toast({
              title: 'Error',
              description: 'Invalid tool call response',
              variant: 'destructive'
            });
            return;
          }
          
          // Send sentiment acknowledgment back to AI
          const { data: finalData, error: finalError } = await supabase.functions.invoke('chat-completion', {
            body: {
              messages: [
                { role: 'system', content: botPrompt },
                ...chatMessages,
                userMessage,
                // Include the assistant's message with the tool call
                { 
                  role: 'assistant', 
                  content: '',
                  tool_calls: data.choices[0].message.tool_calls
                },
                // Add the tool result
                {
                  role: 'tool',
                  tool_call_id: toolCallId,
                  content: JSON.stringify({ acknowledged: true, ...data.tool_arguments })
                }
              ],
              model: selectedChatModel,
              knowledgeBaseId: knowledgeBaseId,
              chatSettings: chatSettings,
              searchEnabled: isSearchEnabled
            }
          });

          if (finalError) throw finalError;

          const finalMessage = finalData.choices[0]?.message?.content;
          if (finalMessage) {
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: finalMessage
            }]);

            addEvent({
              type: 'response.done',
              response: {
                output: [{
                  type: 'message',
                  role: 'assistant',
                  content: [{
                    type: 'text',
                    text: finalMessage
                  }]
                }],
                usage: finalData.usage
              }
            });

            if (finalData.usage) {
              const usage = finalData.usage;
              const newStats = {
                audioInputTokens: 0,
                textInputTokens: usage.prompt_tokens || 0,
                cachedInputTokens: 0,
                audioOutputTokens: 0,
                textOutputTokens: usage.completion_tokens || 0
              };
              const costs = calculateCosts(newStats, pricingConfig);
              const fullStats = {
                ...newStats,
                ...costs
              };
              setCurrentStats(fullStats);
              setSessionStats(prev => ({
                audioInputTokens: prev.audioInputTokens,
                textInputTokens: prev.textInputTokens + newStats.textInputTokens,
                cachedInputTokens: prev.cachedInputTokens,
                audioOutputTokens: prev.audioOutputTokens,
                textOutputTokens: prev.textOutputTokens + newStats.textOutputTokens,
                inputCost: prev.inputCost + costs.inputCost,
                outputCost: prev.outputCost + costs.outputCost,
                totalCost: prev.totalCost + costs.totalCost
              }));
            }
          }
          return;
        }
        
        // Check if AI is requesting knowledge base search
        if (data.requires_tool && data.tool_name === 'search_knowledge_base' && data.tool_arguments) {
          console.log('AI requested knowledge base search:', data.tool_arguments);
          
          // Get the tool call ID from the response
          const toolCallId = data.choices[0]?.message?.tool_calls?.[0]?.id;
          if (!toolCallId) {
            console.error('No tool_call_id found in response');
            toast({
              title: 'Error',
              description: 'Invalid tool call response',
              variant: 'destructive'
            });
            return;
          }
          
          if (!knowledgeBaseId) {
            toast({
              title: 'No Knowledge Base',
              description: 'Please select a knowledge base first',
              variant: 'destructive'
            });
            return;
          }
          
          // Perform knowledge base search
          const { data: kbSearchData, error: kbSearchError } = await supabase.functions.invoke('search-knowledge', {
            body: { 
              query: data.tool_arguments.query,
              knowledge_base_id: knowledgeBaseId,
              match_threshold: 0.5,
              match_count: 5
            }
          });

          if (kbSearchError) {
            console.error('Knowledge base search error:', kbSearchError);
            toast({
              title: 'Search Failed',
              description: 'Failed to search knowledge base',
              variant: 'destructive'
            });
            return;
          }

          // Format knowledge base results
          const formattedKbResults = `\n\n## Knowledge Base Search Results:\n\n` +
            (kbSearchData.results?.map((r: any, i: number) => 
              `${i + 1}. **Relevance: ${(r.similarity * 100).toFixed(1)}%**\n   ${r.content}\n   ${r.metadata?.document_name ? `Source: ${r.metadata.document_name}` : ''}`
            ).join('\n\n') || 'No results found');

          // Send search results back to AI using proper tool calling format
          const { data: finalData, error: finalError } = await supabase.functions.invoke('chat-completion', {
            body: {
              messages: [
                { role: 'system', content: botPrompt },
                ...chatMessages,
                userMessage,
                // Include the assistant's message with the tool call
                { 
                  role: 'assistant', 
                  content: '',
                  tool_calls: data.choices[0].message.tool_calls
                },
                // Add the tool result
                {
                  role: 'tool',
                  tool_call_id: toolCallId,
                  content: formattedKbResults
                }
              ],
              model: selectedChatModel,
              knowledgeBaseId: knowledgeBaseId
            }
          });

          if (finalError) throw finalError;

          const finalMessage = finalData.choices[0]?.message?.content;
          if (finalMessage) {
            setChatMessages(prev => [...prev, {
              role: 'assistant',
              content: finalMessage
            }]);

            addEvent({
              type: 'response.done',
              response: {
                output: [{
                  type: 'message',
                  role: 'assistant',
                  content: [{
                    type: 'text',
                    text: finalMessage
                  }]
                }],
                usage: finalData.usage
              }
            });

            if (finalData.usage) {
              const usage = finalData.usage;
              const newStats = {
                audioInputTokens: 0,
                textInputTokens: usage.prompt_tokens || 0,
                cachedInputTokens: 0,
                audioOutputTokens: 0,
                textOutputTokens: usage.completion_tokens || 0
              };
              const costs = calculateCosts(newStats, pricingConfig);
              const fullStats = {
                ...newStats,
                ...costs
              };
              setCurrentStats(fullStats);
              setSessionStats(prev => ({
                audioInputTokens: prev.audioInputTokens,
                textInputTokens: prev.textInputTokens + newStats.textInputTokens,
                cachedInputTokens: prev.cachedInputTokens,
                audioOutputTokens: prev.audioOutputTokens,
                textOutputTokens: prev.textOutputTokens + newStats.textOutputTokens,
                inputCost: prev.inputCost + costs.inputCost,
                outputCost: prev.outputCost + costs.outputCost,
                totalCost: prev.totalCost + costs.totalCost
              }));
            }
          }
          return;
        }

        const assistantMessage = data.choices[0]?.message?.content;
        if (assistantMessage) {
          // Add assistant message to chat
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: assistantMessage
          }]);

          // Add assistant message to events
          addEvent({
            type: 'response.done',
            response: {
              output: [{
                type: 'message',
                role: 'assistant',
                content: [{
                  type: 'text',
                  text: assistantMessage
                }]
              }],
              usage: data.usage
            }
          });

          // Update stats if usage data is available
          if (data.usage) {
            const usage = data.usage;
            const newStats = {
              audioInputTokens: 0,
              textInputTokens: usage.prompt_tokens || 0,
              cachedInputTokens: 0,
              audioOutputTokens: 0,
              textOutputTokens: usage.completion_tokens || 0
            };
            const costs = calculateCosts(newStats, pricingConfig);
            const fullStats = {
              ...newStats,
              ...costs
            };
            setCurrentStats(fullStats);
            setSessionStats(prev => ({
              audioInputTokens: prev.audioInputTokens,
              textInputTokens: prev.textInputTokens + newStats.textInputTokens,
              cachedInputTokens: prev.cachedInputTokens,
              audioOutputTokens: prev.audioOutputTokens,
              textOutputTokens: prev.textOutputTokens + newStats.textOutputTokens,
              inputCost: prev.inputCost + costs.inputCost,
              outputCost: prev.outputCost + costs.outputCost,
              totalCost: prev.totalCost + costs.totalCost
            }));
          }
        }
      } catch (error) {
        console.error('Error sending chat message:', error);
        toast({
          title: 'Send Failed',
          description: error instanceof Error ? error.message : 'Failed to send message. Please try again.',
          variant: 'destructive'
        });
      }
    }
  };
  const resetAll = () => {
    // Clear all session data and UI state
    setSessionStats(initialStats);
    setCurrentStats(initialStats);
    setTimelineSegments([]);
    setTokenDataPoints([]);
    setCumulativeTokens({
      input: 0,
      output: 0
    });
    setEvents([]);
    setChatMessages([]);
    setSessionStartTime(null);
    sessionStartTimeRef.current = null;
    setCurrentSegment(null);
    setCurrentSentiment(null);
    setIsAudioActive(false);
    setStatusMessage('');
    setStatusType('idle');
    
    toast({
      title: 'Reset Complete',
      description: 'All session data has been cleared'
    });
  };
  const handleLoadSession = (session: any) => {
    setSelectedModel(session.model);
    setSelectedVoice(session.voice);
    setBotPrompt(session.bot_prompt);
    setKnowledgeBaseId(session.knowledge_base_id);
    setPricingConfig(session.pricing_config);
    setSessionStats(session.session_stats);
    setTimelineSegments(session.timeline_segments);
    setTokenDataPoints(session.token_data_points);
    setEvents(session.events);
    setSessionStartTime(session.session_start_time);
    sessionStartTimeRef.current = session.session_start_time;
    const totalInput = session.session_stats.audioInputTokens + session.session_stats.textInputTokens;
    const totalOutput = session.session_stats.audioOutputTokens + session.session_stats.textOutputTokens;
    setCumulativeTokens({
      input: totalInput,
      output: totalOutput
    });
  };
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);
  if (!user || !session) {
    return null;
  }

  const renderView = () => {
    switch (currentView) {
      case 'voice-model':
        return (
          <VoiceModelView
            selectedModel={interactionMode === 'voice' ? selectedModel : selectedChatModel}
            selectedVoice={selectedVoice}
            mode={interactionMode}
            pricingConfig={pricingConfig}
            isConnected={isConnected}
            onModelChange={(model) => {
              if (interactionMode === 'voice') {
                setSelectedModel(model);
              } else {
                setSelectedChatModel(model);
              }
            }}
            onVoiceChange={setSelectedVoice}
            onModeChange={setInteractionMode}
            onPricingChange={setPricingConfig}
            realtimeSettings={realtimeSettings}
            chatSettings={chatSettings}
            onRealtimeSettingsChange={setRealtimeSettings}
            onChatSettingsChange={setChatSettings}
          />
        );
      case 'system-prompt':
        return (
          <SystemPromptView
            currentPrompt={botPrompt}
            onPromptChange={setBotPrompt}
          />
        );
      case 'knowledge-base':
        return (
          <KnowledgeBaseView
            knowledgeBaseId={knowledgeBaseId}
            onKnowledgeBaseChange={setKnowledgeBaseId}
          />
        );
      case 'search-settings':
        return (
          <SearchSettingsView
            searchService={searchService}
            searchTypes={searchTypes}
            onSearchServiceChange={setSearchService}
            onSearchTypesChange={setSearchTypes}
          />
        );
      case 'session':
      default:
        return (
          <SessionView
            isConnected={isConnected}
            isAudioActive={isAudioActive}
            sessionStartTime={sessionStartTime}
            currentSentiment={currentSentiment}
            mode={interactionMode}
            chatInput={chatInput}
            chatMessages={chatMessages}
            currentStats={currentStats}
            sessionStats={sessionStats}
            tokenDataPoints={tokenDataPoints}
            totalInputTokens={
              sessionStats.audioInputTokens +
              sessionStats.textInputTokens +
              sessionStats.cachedInputTokens
            }
            totalOutputTokens={
              sessionStats.audioOutputTokens + sessionStats.textOutputTokens
            }
            events={events}
            onStart={() => startSession(selectedVoice, selectedModel)}
            onStop={stopSession}
            onResetAll={resetAll}
            onChatInputChange={setChatInput}
            onSendMessage={() => {
              if (chatInput.trim()) {
                // Chat mode works without session
                if (interactionMode === 'chat' || isConnected) {
                  sendChatMessage(chatInput);
                  setChatInput('');
                }
              }
            }}
          />
        );
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Left Sidebar - Navigation */}
        <AppSidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          isSessionActive={isConnected}
        />

        {/* Main Content Area */}
        <SidebarInset className="flex-1">
          <div className="h-screen flex flex-col">
            {/* Header */}
            <header className="border-b p-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-2xl font-bold">EPAM AI/Run.Transform SandBox</h1>
                </div>
                <HeaderMenu
                  userEmail={user.email}
                  onLogout={handleLogout}
                  onLoadSession={handleLoadSession}
                  isConnected={isConnected}
                />
              </div>
            </header>

            {/* View Content */}
            <div className="flex-1 overflow-hidden">
              {renderView()}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}