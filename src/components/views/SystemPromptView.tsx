import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Library, Sparkles, Trash2 } from 'lucide-react';
interface SavedPrompt {
  id: string;
  name: string;
  description: string | null;
  prompt_content: string;
  created_at: string;
}
const DEFAULT_PROMPT = "You are a helpful AI assistant. Be concise and friendly in your responses.";
interface SystemPromptViewProps {
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
}
export function SystemPromptView({
  currentPrompt,
  onPromptChange
}: SystemPromptViewProps) {
  const [prompt, setPrompt] = useState<string>(currentPrompt || DEFAULT_PROMPT);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [coilotDialogOpen, setCopilotDialogOpen] = useState(false);
  const [promptName, setPromptName] = useState('');
  const [promptDescription, setPromptDescription] = useState('');
  const [copilotDescription, setCopilotDescription] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    toast
  } = useToast();
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

  // Load saved prompts
  const loadSavedPrompts = async () => {
    setIsLoadingPrompts(true);
    try {
      const {
        data,
        error
      } = await supabase.from('saved_prompts').select('*').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setSavedPrompts(data || []);
    } catch (error) {
      console.error('Error loading prompts:', error);
      toast({
        title: "Error",
        description: "Failed to load saved prompts",
        variant: "destructive"
      });
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  // Save current prompt
  const handleSavePrompt = async () => {
    if (!promptName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this prompt",
        variant: "destructive"
      });
      return;
    }
    setIsSaving(true);
    try {
      const {
        error
      } = await supabase.from('saved_prompts').insert({
        name: promptName,
        description: promptDescription || null,
        prompt_content: prompt,
        user_id: (await supabase.auth.getUser()).data.user?.id
      });
      if (error) throw error;
      toast({
        title: "Saved!",
        description: "Prompt saved to library"
      });
      setPromptName('');
      setPromptDescription('');
      setSaveDialogOpen(false);
      loadSavedPrompts();
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Load a prompt from library
  const handleLoadPrompt = (savedPrompt: SavedPrompt) => {
    setPrompt(savedPrompt.prompt_content);
    localStorage.setItem('bot_prompt', savedPrompt.prompt_content);
    onPromptChange(savedPrompt.prompt_content);
    setLoadDialogOpen(false);
    toast({
      title: "Loaded!",
      description: `Loaded "${savedPrompt.name}"`
    });
  };

  // Delete a saved prompt
  const handleDeletePrompt = async (id: string) => {
    try {
      const {
        error
      } = await supabase.from('saved_prompts').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: "Deleted",
        description: "Prompt removed from library"
      });
      loadSavedPrompts();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive"
      });
    }
  };

  // Generate prompt using AI co-pilot
  const handleGeneratePrompt = async () => {
    if (!copilotDescription.trim()) {
      toast({
        title: "Description required",
        description: "Please describe what you want the AI to do",
        variant: "destructive"
      });
      return;
    }
    setIsGenerating(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('suggest-prompt', {
        body: {
          description: copilotDescription
        }
      });
      if (error) throw error;
      if (data.prompt) {
        setPrompt(data.prompt);
        setCopilotDialogOpen(false);
        setCopilotDescription('');
        toast({
          title: "Prompt generated!",
          description: "Review and save the suggested prompt"
        });
      }
    } catch (error) {
      console.error('Error generating prompt:', error);
      toast({
        title: "Error",
        description: "Failed to generate prompt suggestion",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  return <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">System Prompt</h1>
          <p className="text-muted-foreground">Configure the AI assistant's behavior and personality</p>
        </div>

        <Card>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botPrompt">System Prompt</Label>
              <Textarea ref={textareaRef} id="botPrompt" value={prompt} onChange={e => setPrompt(e.target.value)} className="font-mono text-sm resize-none overflow-hidden min-h-[400px]" placeholder="Enter the bot's system prompt..." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Apply
              </Button>
              
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Save className="h-4 w-4 mr-2" />
                    Save to Library
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Prompt</DialogTitle>
                    <DialogDescription>
                      Save this prompt to your library for reuse
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="promptName">Name</Label>
                      <Input id="promptName" value={promptName} onChange={e => setPromptName(e.target.value)} placeholder="e.g., Customer Support Bot" />
                    </div>
                    <div>
                      <Label htmlFor="promptDesc">Description (optional)</Label>
                      <Textarea id="promptDesc" value={promptDescription} onChange={e => setPromptDescription(e.target.value)} placeholder="What is this prompt for?" rows={3} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSavePrompt} disabled={isSaving}>
                      {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={loadDialogOpen} onOpenChange={open => {
              setLoadDialogOpen(open);
              if (open) loadSavedPrompts();
            }}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Library className="h-4 w-4 mr-2" />
                    Load from Library
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Prompt Library</DialogTitle>
                    <DialogDescription>
                      Select a saved prompt to load
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {isLoadingPrompts ? <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div> : savedPrompts.length === 0 ? <p className="text-center text-muted-foreground py-8">
                        No saved prompts yet
                      </p> : savedPrompts.map(savedPrompt => <Card key={savedPrompt.id} className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold truncate">{savedPrompt.name}</h4>
                              {savedPrompt.description && <p className="text-sm text-muted-foreground mt-1">
                                  {savedPrompt.description}
                                </p>}
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {savedPrompt.prompt_content}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleLoadPrompt(savedPrompt)}>
                                Load
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeletePrompt(savedPrompt.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>)}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={coilotDialogOpen} onOpenChange={setCopilotDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Co-pilot
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Prompt Co-pilot</DialogTitle>
                    <DialogDescription>
                      Describe what you want your AI assistant to do, and we'll suggest a prompt
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="copilotDesc">What should the AI do?</Label>
                      <Textarea id="copilotDesc" value={copilotDescription} onChange={e => setCopilotDescription(e.target.value)} placeholder="e.g., Help customers with technical support issues, be empathetic and provide clear step-by-step solutions" rows={4} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleGeneratePrompt} disabled={isGenerating}>
                      {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Generate Prompt
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button onClick={handleReset} variant="outline">
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
}