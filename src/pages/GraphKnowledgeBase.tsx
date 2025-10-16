import { GraphKnowledgeBaseManager } from '@/components/GraphKnowledgeBaseManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GraphKnowledgeBase = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Conversations
        </Button>
      </div>
      <GraphKnowledgeBaseManager />
    </div>
  );
};

export default GraphKnowledgeBase;
