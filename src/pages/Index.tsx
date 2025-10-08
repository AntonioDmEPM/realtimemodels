import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send } from 'lucide-react';
import VoiceControls from '@/components/VoiceControls';
import StatsDisplay from '@/components/StatsDisplay';
import EventLog from '@/components/EventLog';
import AudioIndicator from '@/components/AudioIndicator';
import PricingSettings from '@/components/PricingSettings';
import PromptSettings from '@/components/PromptSettings';
import { KnowledgeBaseSelector } from '@/components/KnowledgeBaseSelector';
import ConversationTimer from '@/components/ConversationTimer';
import ConversationTimeline, { TimelineSegment } from '@/components/ConversationTimeline';
import TokenDashboard, { TokenDataPoint } from '@/components/TokenDashboard';
import ConversationMessages from '@/components/ConversationMessages';
import HeaderMenu from '@/components/HeaderMenu';
import { createRealtimeSession, AudioVisualizer, calculateCosts, SessionStats, UsageEvent, PricingConfig } from '@/utils/webrtcAudio';
import { useToast } from '@/hooks/use-toast';

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
  totalCost: 0,
};

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
  const [botPrompt, setBotPrompt] = useState('You are a helpful AI assistant. Be concise and friendly in your responses.');
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | undefined>(undefined);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    audioInputCost: 0.00004,
    audioOutputCost: 0.00008,
    cachedAudioCost: 0.0000025,
    textInputCost: 0.0000025,
    textOutputCost: 0.00001,
  });
  
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const [timelineSegments, setTimelineSegments] = useState<TimelineSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<Partial<TimelineSegment> | null>(null);
  const [tokenDataPoints, setTokenDataPoints] = useState<TokenDataPoint[]>([]);
  const [cumulativeTokens, setCumulativeTokens] = useState({ input: 0, output: 0 });
  const [interactionMode, setInteractionMode] = useState<'voice' | 'chat'>('voice');
  const [chatInput, setChatInput] = useState('');

  // Authentication check
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, authSession) => {
        setSession(authSession);
        setUser(authSession?.user ?? null);
        
        if (!authSession) {
          navigate('/auth');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      setSession(authSession);
      setUser(authSession?.user ?? null);
      
      if (!authSession) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const addEvent = (data: any) => {
    const entry: EventEntry = {
      timestamp: new Date().toISOString(),
      data,
    };
    // Store all events for the session without limiting
    setEvents((prev) => [entry, ...prev]);
  };

  const handleMessage = (eventData: UsageEvent) => {
    addEvent(eventData);

    // Track timeline segments
    if (eventData.type === 'input_audio_buffer.speech_started') {
      setCurrentSegment({
        start: Date.now(),
        speaker: 'user',
      });
    } else if (eventData.type === 'input_audio_buffer.speech_stopped') {
      if (currentSegment?.start && currentSegment.speaker === 'user') {
        const end = Date.now();
        setTimelineSegments(prev => [...prev, {
          start: currentSegment.start,
          end,
          duration: end - currentSegment.start,
          speaker: 'user',
        }]);
        setCurrentSegment(null);
      }
    } else if (eventData.type === 'response.audio.delta') {
      if (!currentSegment || currentSegment.speaker !== 'assistant') {
        setCurrentSegment({
          start: Date.now(),
          speaker: 'assistant',
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
          outputTokens: currentSegment.outputTokens,
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
      const cachedDetails = inputDetails.cached_tokens_details || { audio_tokens: 0, text_tokens: 0 };

      console.log('Input details:', inputDetails);
      console.log('Output details:', outputDetails);
      console.log('Cached details:', cachedDetails);

      const newStats = {
        audioInputTokens: inputDetails.audio_tokens - cachedDetails.audio_tokens,
        textInputTokens: inputDetails.text_tokens - cachedDetails.text_tokens,
        cachedInputTokens: inputDetails.cached_tokens || 0,
        audioOutputTokens: outputDetails.audio_tokens,
        textOutputTokens: outputDetails.text_tokens,
      };

      console.log('Calculated newStats:', newStats);

      const costs = calculateCosts(newStats, pricingConfig);
      const fullStats = { ...newStats, ...costs };

      setCurrentStats(fullStats);
      
      // Store token data in current segment for timeline
      const totalInput = newStats.audioInputTokens + newStats.textInputTokens;
      const totalOutput = newStats.audioOutputTokens + newStats.textOutputTokens;
      
      setCurrentSegment(prev => {
        if (prev && prev.speaker === 'assistant') {
          return {
            ...prev,
            inputTokens: totalInput,
            outputTokens: totalOutput,
          };
        }
        return prev;
      });

      setSessionStats((prev) => {
        const updated = {
          audioInputTokens: prev.audioInputTokens + newStats.audioInputTokens,
          textInputTokens: prev.textInputTokens + newStats.textInputTokens,
          cachedInputTokens: prev.cachedInputTokens + newStats.cachedInputTokens,
          audioOutputTokens: prev.audioOutputTokens + newStats.audioOutputTokens,
          textOutputTokens: prev.textOutputTokens + newStats.textOutputTokens,
          inputCost: prev.inputCost + costs.inputCost,
          outputCost: prev.outputCost + costs.outputCost,
          totalCost: prev.totalCost + costs.totalCost,
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
            cumulativeOutput: newCumulativeOutput,
          };

          console.log('Created data point:', dataPoint);
          setTokenDataPoints(prevPoints => {
            const updated = [...prevPoints, dataPoint];
            console.log('Updated tokenDataPoints array length:', updated.length);
            return updated;
          });
          
          return {
            input: newCumulativeInput,
            output: newCumulativeOutput,
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
      setStatusMessage('Getting session token...');

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-realtime-token', {
        body: { model, voice }
      });

      if (tokenError || !tokenData?.client_secret?.value) {
        throw new Error(tokenError?.message || 'Failed to get session token');
      }

      const token = tokenData.client_secret.value;

      let stream: MediaStream;
      
      if (interactionMode === 'voice') {
        setStatusMessage('Requesting microphone access...');

        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        setAudioStream(stream);

        const visualizer = new AudioVisualizer(setIsAudioActive);
        visualizer.setup(stream);
        setAudioVisualizer(visualizer);
      } else {
        // Create silent audio track for chat mode (WebRTC requires at least one track)
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const destination = audioContext.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        stream = destination.stream;
      }

      setStatusMessage('Establishing connection...');

      const { pc, dc } = await createRealtimeSession(
        stream, 
        token, 
        voice, 
        model, 
        botPrompt, 
        handleMessage, 
        knowledgeBaseId || undefined,
        interactionMode === 'chat' // textOnly flag
      );
      setPeerConnection(pc);
      setDataChannel(dc);

      const startTime = Date.now();
      sessionStartTimeRef.current = startTime;
      setIsConnected(true);
      setSessionStartTime(startTime);
      setTokenDataPoints([]);
      setCumulativeTokens({ input: 0, output: 0 });
      setStatusType('success');
      setStatusMessage('Session established successfully!');

      toast({
        title: 'Connected',
        description: 'Voice session is active',
      });
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(`Error: ${err.message}`);
      console.error('Session error:', err);
      stopSession();

      toast({
        title: 'Connection Failed',
        description: err.message,
        variant: 'destructive',
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
        duration_ms: Date.now() - sessionStartTime,
      };

      const { error } = await supabase
        .from('sessions')
        .insert([sessionData]);

      if (error) {
        console.error('Error auto-saving session:', error);
      } else {
        toast({
          title: 'Session Saved',
          description: 'Session automatically saved',
        });
      }
    }

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
      audioStream.getTracks().forEach((track) => track.stop());
      setAudioStream(null);
    }

    setIsConnected(false);
    setIsAudioActive(false);
    setStatusType('idle');
    setStatusMessage('');
    setCurrentStats(initialStats);
    sessionStartTimeRef.current = null;
    setSessionStartTime(null);
    setCurrentSegment(null);
  };

  const sendChatMessage = (message: string) => {
    if (!dataChannel || dataChannel.readyState !== 'open' || !message.trim()) {
      toast({
        title: 'Unable to send',
        description: 'Connection not ready. Please wait or start a session.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Send text message through data channel
      const event = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: message
            }
          ]
        }
      };

      dataChannel.send(JSON.stringify(event));
      dataChannel.send(JSON.stringify({ type: 'response.create' }));
      
      console.log('Sent text message:', message);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Send Failed',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const clearEvents = () => {
    setEvents([]);
  };

  const resetSessionTotals = () => {
    setSessionStats(initialStats);
    setTimelineSegments([]);
    setTokenDataPoints([]);
    setCumulativeTokens({ input: 0, output: 0 });
    toast({
      title: 'Session Totals Reset',
      description: 'All session statistics have been cleared',
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
    setCumulativeTokens({ input: totalInput, output: totalOutput });
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  if (!user || !session) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-4xl md:text-6xl font-bold">
              <span className="text-primary">EPAM AI/Run™</span>.ClarityRTC
            </h2>
            <HeaderMenu
              userEmail={user.email}
              onLogout={handleLogout}
              onLoadSession={handleLoadSession}
              isConnected={isConnected}
            />
          </div>
        </header>

        <div className="space-y-6">
          <Card className="p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="mode-toggle" className="text-base font-semibold">
                  Interaction Mode
                </Label>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${interactionMode === 'voice' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    Voice
                  </span>
                  <Switch
                    id="mode-toggle"
                    checked={interactionMode === 'chat'}
                    onCheckedChange={(checked) => setInteractionMode(checked ? 'chat' : 'voice')}
                    disabled={isConnected}
                  />
                  <span className={`text-sm ${interactionMode === 'chat' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    Chat
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex-1 min-w-0">
                  <AudioIndicator isActive={isAudioActive} />
                </div>
                <div className="flex-shrink-0 ml-6">
                  <ConversationTimer isActive={isConnected} startTime={sessionStartTime} />
                </div>
              </div>
            </div>
          </Card>

          {interactionMode === 'voice' ? (
            <VoiceControls
              onStart={startSession}
              onStop={stopSession}
              isConnected={isConnected}
              statusMessage={statusMessage}
              statusType={statusType}
              onModelChange={setSelectedModel}
            />
          ) : (
            <Card className="p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="chat-model">Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isConnected}>
                    <SelectTrigger id="chat-model" className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-realtime-preview-2024-12-17">GPT-4o Realtime (2024-12-17)</SelectItem>
                      <SelectItem value="gpt-4o-mini-realtime-preview-2024-12-17">GPT-4o Mini Realtime (2024-12-17)</SelectItem>
                      <SelectItem value="gpt-realtime">GPT Realtime</SelectItem>
                      <SelectItem value="gpt-realtime-mini">GPT Realtime Mini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={isConnected ? stopSession : () => startSession('alloy', selectedModel)}
                  className="w-full bg-primary hover:bg-primary/90"
                  variant={isConnected ? 'destructive' : 'default'}
                >
                  {isConnected ? 'Stop Session' : 'Start Chat Session'}
                </Button>

                {statusMessage && (
                  <p className={`text-sm font-medium transition-smooth ${
                    statusType === 'success' ? 'text-accent' :
                    statusType === 'error' ? 'text-destructive' :
                    statusType === 'connecting' ? 'text-primary' :
                    'text-muted-foreground'
                  }`}>
                    {statusMessage}
                  </p>
                )}
              </div>
            </Card>
          )}

          <PromptSettings onPromptChange={setBotPrompt} currentPrompt={botPrompt} />

          <KnowledgeBaseSelector 
            value={knowledgeBaseId}
            onChange={setKnowledgeBaseId}
          />

          <PricingSettings 
            onPricingChange={setPricingConfig}
            selectedModel={selectedModel}
          />

          <div className="grid lg:grid-cols-1 gap-6">
            <StatsDisplay title="Most Recent Interaction" stats={currentStats} />
            <StatsDisplay 
              title="Session Total" 
              stats={sessionStats}
              onReset={resetSessionTotals}
              resetDisabled={isConnected}
            />
          </div>

          <div className="text-sm text-muted-foreground italic">
            Note: Cost calculations are estimates based on published rates and may not be 100% accurate.
          </div>

          <TokenDashboard 
            dataPoints={tokenDataPoints}
            sessionStartTime={sessionStartTime}
            isActive={isConnected}
            totalInputTokens={sessionStats.audioInputTokens + sessionStats.textInputTokens + sessionStats.cachedInputTokens}
            totalOutputTokens={sessionStats.audioOutputTokens + sessionStats.textOutputTokens}
          />

          <ConversationTimeline segments={timelineSegments} sessionStartTime={sessionStartTime} />

          <Card>
            <ConversationMessages events={events} />
            
            {interactionMode === 'chat' && (
              <div className="border-t p-4 bg-background">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (chatInput.trim() && isConnected) {
                      sendChatMessage(chatInput);
                      setChatInput('');
                    }
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={isConnected ? "Type your message..." : "Start a session to chat"}
                    disabled={!isConnected}
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    size="icon"
                    disabled={!isConnected || !chatInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}
          </Card>

          <EventLog events={events} onClearEvents={clearEvents} />
        </div>
      </div>
    </div>
  );
}
