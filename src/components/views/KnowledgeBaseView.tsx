import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { KnowledgeBaseSelector } from '@/components/KnowledgeBaseSelector';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface KnowledgeBaseViewProps {
  knowledgeBaseId: string | undefined;
  onKnowledgeBaseChange: (id: string | undefined) => void;
}

export function KnowledgeBaseView({ knowledgeBaseId, onKnowledgeBaseChange }: KnowledgeBaseViewProps) {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
          <p className="text-muted-foreground">Connect a knowledge base for context-aware responses</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Knowledge Base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <KnowledgeBaseSelector
              value={knowledgeBaseId}
              onChange={onKnowledgeBaseChange}
            />
            
            <div className="pt-4 border-t">
              <Link to="/knowledge-base">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage Knowledge Bases
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
