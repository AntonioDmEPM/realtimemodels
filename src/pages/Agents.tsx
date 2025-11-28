import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Database, Sparkles } from 'lucide-react';
import AgentChat from '@/components/AgentChat';
import { toast } from 'sonner';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
}

export default function Agents() {
  const navigate = useNavigate();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to access agents');
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('knowledge_bases')
        .select('id, name, description')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKnowledgeBases(data || []);
    } catch (error) {
      console.error('Error loading knowledge bases:', error);
      toast.error('Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Multi-Agent System</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[300px_1fr] gap-6 h-[calc(100vh-120px)]">
          {/* Sidebar */}
          <div className="space-y-6">
            <div className="p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Configuration
              </h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="kb-select">Knowledge Base</Label>
                  <Select value={selectedKB} onValueChange={setSelectedKB}>
                    <SelectTrigger id="kb-select">
                      <SelectValue placeholder="Select a knowledge base" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No knowledge base</SelectItem>
                      {knowledgeBases.map((kb) => (
                        <SelectItem key={kb.id} value={kb.id}>
                          {kb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select a knowledge base to enable the KB agent
                  </p>
                </div>
              </div>
            </div>

            {/* Agent Info */}
            <div className="p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm">
              <h2 className="text-sm font-semibold mb-3">Available Agents</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-2 rounded bg-muted/50">
                  <Database className="h-4 w-4 mt-0.5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Knowledge Base</p>
                    <p className="text-xs text-muted-foreground">
                      Searches your uploaded documents
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2 rounded bg-muted/50">
                  <svg className="h-4 w-4 mt-0.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium">Web Search</p>
                    <p className="text-xs text-muted-foreground">
                      Searches the internet for current info
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <AgentChat knowledgeBaseId={selectedKB !== 'none' ? selectedKB : undefined} />
        </div>
      </main>
    </div>
  );
}
