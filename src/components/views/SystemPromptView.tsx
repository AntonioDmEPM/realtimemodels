import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const DEFAULT_PROMPT = "You are a helpful AI assistant. Be concise and friendly in your responses.";

interface SystemPromptViewProps {
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
}

export function SystemPromptView({ currentPrompt, onPromptChange }: SystemPromptViewProps) {
  const [prompt, setPrompt] = useState<string>(currentPrompt || DEFAULT_PROMPT);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentPrompt !== undefined) {
      setPrompt(currentPrompt);
    }
  }, [currentPrompt]);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    autoResize();
  }, [prompt]);

  const handleSave = () => {
    localStorage.setItem('bot_prompt', prompt);
    onPromptChange(prompt);
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
    localStorage.removeItem('bot_prompt');
    onPromptChange(DEFAULT_PROMPT);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">System Prompt</h1>
          <p className="text-muted-foreground">Configure the AI assistant's behavior and personality</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bot Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botPrompt">System Prompt</Label>
              <Textarea
                ref={textareaRef}
                id="botPrompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="font-mono text-sm resize-none overflow-hidden min-h-[400px]"
                placeholder="Enter the bot's system prompt..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>Save Prompt</Button>
              <Button onClick={handleReset} variant="outline">Reset to Default</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
