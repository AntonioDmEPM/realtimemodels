// Advanced settings for Real-time API models
export interface RealtimeModelSettings {
  temperature: number;
  maxOutputTokens: number | 'inf';
  modalities: ('text' | 'audio')[];
  turnDetection: {
    type: 'server_vad' | 'none';
    threshold: number;
    prefixPaddingMs: number;
    silenceDurationMs: number;
  } | null;
  inputAudioTranscription: boolean;
  stopSequences: string[];
}

// Advanced settings for Chat models (GPT-5)
export interface ChatModelSettings {
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  stopSequences: string[];
  frequencyPenalty: number;
  presencePenalty: number;
}

// Default settings
export const DEFAULT_REALTIME_SETTINGS: RealtimeModelSettings = {
  temperature: 0.8,
  maxOutputTokens: 'inf',
  modalities: ['audio', 'text'],
  turnDetection: {
    type: 'server_vad',
    threshold: 0.5,
    prefixPaddingMs: 300,
    silenceDurationMs: 1000
  },
  inputAudioTranscription: true,
  stopSequences: []
};

export const DEFAULT_CHAT_SETTINGS: ChatModelSettings = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 4096,
  stopSequences: [],
  frequencyPenalty: 0,
  presencePenalty: 0
};
