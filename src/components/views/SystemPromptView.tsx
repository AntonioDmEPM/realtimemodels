import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
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
import { useTheme } from 'next-themes';

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

export function SystemPromptView({ currentPrompt, onPromptChange }: SystemPromptViewProps) {
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
  const [improvedPrompt, setImprovedPrompt] = useState('');
  const { toast } = useToast();
  const { theme } = useTheme();

  useEffect(() => {
    if (currentPrompt !== undefined) {
      setPrompt(currentPrompt);
    }
  }, [currentPrompt]);

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
      const { data, error } = await supabase
        .from('saved_prompts')
        .select('*')
        .order('created_at', { ascending: false });

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
      const { error } = await supabase
        .from('saved_prompts')
        .insert({
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
      const { error } = await supabase
        .from('saved_prompts')
        .delete()
        .eq('id', id);

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

  // Improve prompt using AI co-pilot
  const handleImprovePrompt = async () => {
    if (!prompt.trim()) {
      toast({
        title: "No prompt to improve",
        description: "Please enter a prompt first",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-prompt', {
        body: { currentPrompt: prompt }
      });

      if (error) throw error;

      if (data.prompt) {
        setImprovedPrompt(data.prompt);
        toast({
          title: "Improvements suggested!",
          description: "Review the suggestions below"
        });
      }
    } catch (error) {
      console.error('Error improving prompt:', error);
      toast({
        title: "Error",
        description: "Failed to generate improvements",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyImprovement = () => {
    setPrompt(improvedPrompt);
    setImprovedPrompt('');
    setCopilotDialogOpen(false);
    toast({
      title: "Applied!",
      description: "Improvements have been applied to your prompt"
    });
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
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
              <div className="border border-muted-foreground/20 rounded-md overflow-hidden">
                <Editor
                  height="500px"
                  defaultLanguage="yaml"
                  value={prompt}
                  onChange={(value) => setPrompt(value || '')}
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    padding: { top: 16, bottom: 16 },
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                  }}
                />
              </div>
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
                      <Input
                        id="promptName"
                        value={promptName}
                        onChange={(e) => setPromptName(e.target.value)}
                        placeholder="e.g., Customer Support Bot"
                      />
                    </div>
                    <div>
                      <Label htmlFor="promptDesc">Description (optional)</Label>
                      <Textarea
                        id="promptDesc"
                        value={promptDescription}
                        onChange={(e) => setPromptDescription(e.target.value)}
                        placeholder="What is this prompt for?"
                        rows={3}
                      />
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

              <Dialog open={loadDialogOpen} onOpenChange={(open) => {
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
                    {isLoadingPrompts ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : savedPrompts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No saved prompts yet
                      </p>
                    ) : (
                      savedPrompts.map((savedPrompt) => (
                        <Card key={savedPrompt.id} className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold truncate">{savedPrompt.name}</h4>
                              {savedPrompt.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {savedPrompt.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {savedPrompt.prompt_content}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleLoadPrompt(savedPrompt)}
                              >
                                Load
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeletePrompt(savedPrompt.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={coilotDialogOpen} onOpenChange={(open) => {
                setCopilotDialogOpen(open);
                if (!open) setImprovedPrompt('');
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Co-pilot
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Prompt Co-pilot</DialogTitle>
                    <DialogDescription>
                      AI will analyze your current prompt and suggest improvements
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 overflow-y-auto max-h-[60vh]">
                    {!improvedPrompt ? (
                      <div className="space-y-4">
                        <div>
                          <Label>Current Prompt</Label>
                          <div className="border border-muted-foreground/20 rounded-md overflow-hidden mt-2">
                            <Editor
                              height="200px"
                              defaultLanguage="yaml"
                              value={prompt}
                              theme={theme === 'dark' ? 'vs-dark' : 'light'}
                              options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                fontSize: 13,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                automaticLayout: true,
                                padding: { top: 12, bottom: 12 },
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                              }}
                            />
                          </div>
                        </div>
                        <Button onClick={handleImprovePrompt} disabled={isGenerating} className="w-full">
                          {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Analyze & Suggest Improvements
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <Label>Current Prompt</Label>
                          <div className="border border-muted-foreground/20 rounded-md overflow-hidden mt-2 bg-muted">
                            <Editor
                              height="150px"
                              defaultLanguage="yaml"
                              value={prompt}
                              theme={theme === 'dark' ? 'vs-dark' : 'light'}
                              options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                fontSize: 13,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                automaticLayout: true,
                                padding: { top: 12, bottom: 12 },
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Suggested Improvements</Label>
                          <div className="border border-muted-foreground/20 rounded-md overflow-hidden mt-2">
                            <Editor
                              height="150px"
                              defaultLanguage="yaml"
                              value={improvedPrompt}
                              onChange={(value) => setImprovedPrompt(value || '')}
                              theme={theme === 'dark' ? 'vs-dark' : 'light'}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                automaticLayout: true,
                                padding: { top: 12, bottom: 12 },
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleApplyImprovement} className="flex-1">
                            Apply Improvements
                          </Button>
                          <Button onClick={handleImprovePrompt} variant="outline" disabled={isGenerating}>
                            {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Regenerate
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Button onClick={handleReset} variant="outline">
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
