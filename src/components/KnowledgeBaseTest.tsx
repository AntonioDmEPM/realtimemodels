import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const KnowledgeBaseTest = ({ knowledgeBaseId }: { knowledgeBaseId: string }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const testSearch = async () => {
    if (!query.trim()) {
      toast({ title: 'Please enter a search query', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast({ title: 'Not authenticated', variant: 'destructive' });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-knowledge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            query,
            knowledge_base_id: knowledgeBaseId,
            match_threshold: 0.5,
            match_count: 5,
          }),
        }
      );

      const data = await response.json();
      
      if (data.error) {
        toast({ title: 'Search failed', description: data.error, variant: 'destructive' });
      } else {
        setResults(data.results || []);
        toast({ 
          title: 'Search completed', 
          description: `Found ${data.results?.length || 0} results` 
        });
      }
    } catch (error) {
      console.error('Search test error:', error);
      toast({ title: 'Search test failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Test Knowledge Base Search</h3>
      
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter search query..."
          onKeyDown={(e) => e.key === 'Enter' && testSearch()}
        />
        <Button onClick={testSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Test Search'}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Results ({results.length}):</h4>
          {results.map((result, idx) => (
            <Card key={idx} className="p-3 space-y-1">
              <div className="text-sm font-medium">
                Similarity: {(result.similarity * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">
                {result.content.substring(0, 200)}...
              </div>
              {result.metadata && (
                <div className="text-xs text-muted-foreground">
                  Source: {result.metadata.document_name || 'Unknown'}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {results.length === 0 && !loading && query && (
        <p className="text-sm text-muted-foreground">No results found</p>
      )}
    </Card>
  );
};
