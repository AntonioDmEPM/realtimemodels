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
import { Database, ExternalLink, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
}

export type KnowledgeBaseType = 'rag' | 'graphrag';

interface KnowledgeBaseSelectorProps {
  value?: string;
  onChange: (value: string | undefined, type: KnowledgeBaseType) => void;
  kbType: KnowledgeBaseType;
  onTypeChange: (type: KnowledgeBaseType) => void;
}

export const KnowledgeBaseSelector = ({ value, onChange, kbType, onTypeChange }: KnowledgeBaseSelectorProps) => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadKnowledgeBases();
  }, [kbType]);

  const loadKnowledgeBases = async () => {
    setIsLoading(true);
    try {
      const tableName = kbType === 'rag' ? 'knowledge_bases' : 'graph_knowledge_bases';
      const { data, error } = await supabase
        .from(tableName)
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setKnowledgeBases(data || []);
      // Reset selection when switching types
      onChange(undefined, kbType);
    } catch (error) {
      console.error('Error loading knowledge bases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Knowledge Base (Optional)
        </Label>
        <div className="flex gap-2">
          <Link to="/knowledge-base">
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              Manage RAG <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          <Link to="/graph-knowledge-base">
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              Manage GraphRAG <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={kbType} onValueChange={(val) => onTypeChange(val as KnowledgeBaseType)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rag" className="flex items-center gap-2">
            <Database className="h-3 w-3" />
            Vector RAG
          </TabsTrigger>
          <TabsTrigger value="graphrag" className="flex items-center gap-2">
            <Network className="h-3 w-3" />
            GraphRAG
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      <Select
        value={value || 'none'}
        onValueChange={(val) => onChange(val === 'none' ? undefined : val, kbType)}
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
          {kbType === 'rag' 
            ? 'The agent will search this vector knowledge base to answer questions'
            : 'The agent will search this graph knowledge base to answer questions'}
        </p>
      )}
    </div>
  );
};