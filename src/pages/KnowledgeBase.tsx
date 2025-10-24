import { KnowledgeBaseManager } from '@/components/KnowledgeBaseManager';
import { KnowledgeBaseTest } from '@/components/KnowledgeBaseTest';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const KnowledgeBase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const testKbId = searchParams.get('test');

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
      
      {testKbId && (
        <div className="mb-6">
          <KnowledgeBaseTest knowledgeBaseId={testKbId} />
        </div>
      )}
      
      <KnowledgeBaseManager />
    </div>
  );
};

export default KnowledgeBase;