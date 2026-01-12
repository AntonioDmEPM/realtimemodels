// Utility to adapt AI tone based on detected sentiment
import { logger } from './logger';

export function generateToneInstructions(
  baseTone: string,
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null,
  adaptiveTone: boolean
): string {
  if (!adaptiveTone || !sentiment) {
    return baseTone;
  }

  const toneModifiers = {
    positive: `
      
TONE ADAPTATION (Current sentiment: Positive):
- Match the user's enthusiasm and energy
- Use encouraging and supportive language
- Feel free to be more conversational and warm
- Celebrate successes or good news with the user`,
    
    negative: `
      
TONE ADAPTATION (Current sentiment: Negative):
- Be empathetic, supportive, and understanding
- Use a calm, reassuring tone
- Avoid overly cheerful language
- Focus on problem-solving and offering help
- Validate the user's feelings before providing solutions`,
    
    neutral: `
      
TONE ADAPTATION (Current sentiment: Neutral):
- Maintain a professional and balanced tone
- Be clear and informative
- Stay engaged but not overly casual`,
    
    mixed: `
      
TONE ADAPTATION (Current sentiment: Mixed):
- Balance empathy with optimism
- Acknowledge complexities in the situation
- Be adaptable and read cues carefully
- Offer both support and practical solutions`
  };

  return baseTone + toneModifiers[sentiment];
}

export function updateSessionTone(
  dataChannel: RTCDataChannel | null,
  baseInstructions: string,
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null,
  adaptiveTone: boolean
) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    logger.log('Cannot update tone: data channel not ready');
    return;
  }

  const adaptedInstructions = generateToneInstructions(
    baseInstructions,
    sentiment,
    adaptiveTone
  );

  const sessionUpdate = {
    type: 'session.update',
    session: {
      instructions: adaptedInstructions
    }
  };

  dataChannel.send(JSON.stringify(sessionUpdate));
  logger.log('Session tone updated for sentiment:', sentiment);
}
