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
  onMessage: (data: any) => void
): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection();

  pc.ontrack = (e) => {
    const audio = new Audio();
    audio.srcObject = e.streams[0];
    audio.play();
  };

  pc.addTrack(inStream.getTracks()[0]);

  const dc = pc.createDataChannel('oai-events');
  
  let sessionCreated = false;
  
  dc.addEventListener('message', (e) => {
    try {
      const eventData = JSON.parse(e.data);
      
      // Send session.update with instructions after receiving session.created
      if (eventData.type === 'session.created' && !sessionCreated) {
        sessionCreated = true;
        console.log('Session created, sending configuration update...');
        
        const sessionUpdate = {
          type: 'session.update',
          session: {
            instructions: instructions,
            voice: voice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.8,
            max_response_output_tokens: 'inf'
          }
        };
        
        dc.send(JSON.stringify(sessionUpdate));
        console.log('Session updated with voice:', voice, 'and instructions:', instructions);
      }
      
      onMessage(eventData);
    } catch (err) {
      console.error('Error parsing event data:', err);
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/sdp',
  };

  const opts = {
    method: 'POST',
    body: offer.sdp,
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

  return pc;
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
