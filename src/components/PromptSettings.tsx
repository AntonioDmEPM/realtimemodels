import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

const DEFAULT_PROMPT = "You are a helpful AI assistant. Be concise and friendly in your responses.";

interface PromptSettingsProps {
  onPromptChange: (prompt: string) => void;
  currentPrompt?: string;
}

export default function PromptSettings({ onPromptChange, currentPrompt }: PromptSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
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
    const saved = localStorage.getItem('bot_prompt');
    if (saved) {
      setPrompt(saved);
      onPromptChange(saved);
    } else {
      onPromptChange(DEFAULT_PROMPT);
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [prompt, isOpen]);

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
    <Card className="p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <h2 className="text-xl font-semibold">Prompt</h2>
          <ChevronDown className={`transition-transform text-primary ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botPrompt">Bot Instructions</Label>
            <Textarea
              ref={textareaRef}
              id="botPrompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="font-mono text-sm bg-background/50 resize-none overflow-hidden min-h-[150px]"
              placeholder="Enter the bot's system prompt..."
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">Save Prompt</Button>
            <Button onClick={handleReset} variant="outline" className="border-primary/30 hover:bg-primary/10">Reset to Default</Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
