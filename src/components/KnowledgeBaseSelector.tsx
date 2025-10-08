import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Database, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
}

interface KnowledgeBaseSelectorProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export const KnowledgeBaseSelector = ({ value, onChange }: KnowledgeBaseSelectorProps) => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_bases')
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setKnowledgeBases(data || []);
    } catch (error) {
      console.error('Error loading knowledge bases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Knowledge Base (Optional)
        </Label>
        <Link to="/knowledge-base">
          <Button variant="ghost" size="sm" className="h-6 text-xs">
            Manage <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
      
      <Select
        value={value || 'none'}
        onValueChange={(val) => onChange(val === 'none' ? undefined : val)}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? 'Loading...' : 'No knowledge base'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No knowledge base</SelectItem>
          {knowledgeBases.map((kb) => (
            <SelectItem key={kb.id} value={kb.id}>
              {kb.name}
              {kb.description && (
                <span className="text-xs text-muted-foreground ml-2">
                  {kb.description}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {value && (
        <p className="text-xs text-muted-foreground">
          The agent will search this knowledge base to answer questions
        </p>
      )}
    </div>
  );
};