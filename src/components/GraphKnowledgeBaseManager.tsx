import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Upload, Network } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface GraphKnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface GraphDocument {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  entity_count: number | null;
  relationship_count: number | null;
  created_at: string;
}

export const GraphKnowledgeBaseManager = () => {
  const { toast } = useToast();
  const [knowledgeBases, setKnowledgeBases] = useState<GraphKnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<GraphKnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<GraphDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [newKBName, setNewKBName] = useState('');
  const [newKBDescription, setNewKBDescription] = useState('');
  const [createKBOpen, setCreateKBOpen] = useState(false);

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  useEffect(() => {
    if (selectedKB) {
      loadDocuments(selectedKB.id);
    }
  }, [selectedKB]);

  const loadKnowledgeBases = async () => {
    try {
      const { data, error } = await supabase
        .from('graph_knowledge_bases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKnowledgeBases(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (kbId: string) => {
    try {
      const { data, error } = await supabase
        .from('graph_documents')
        .select('*')
        .eq('graph_knowledge_base_id', kbId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const createKnowledgeBase = async () => {
    if (!newKBName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a knowledge base name',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('graph_knowledge_bases')
        .insert({
          user_id: user.id,
          name: newKBName,
          description: newKBDescription,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Graph knowledge base created successfully',
      });

      setNewKBName('');
      setNewKBDescription('');
      setCreateKBOpen(false);
      await loadKnowledgeBases();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteKnowledgeBase = async (kbId: string) => {
    if (!confirm('Are you sure you want to delete this knowledge base? All documents and graph data will be deleted.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('graph_knowledge_bases')
        .delete()
        .eq('id', kbId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Knowledge base deleted',
      });

      if (selectedKB?.id === kbId) {
        setSelectedKB(null);
        setDocuments([]);
      }

      await loadKnowledgeBases();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  };

  const uploadDocument = async (file: File) => {
    if (!selectedKB) {
      toast({
        title: 'Error',
        description: 'Please select a knowledge base first',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      let textContent = '';
      
      if (file.type === 'application/pdf') {
        setUploadProgress(20);
        textContent = await extractTextFromPDF(file);
      } else {
        textContent = await file.text();
      }

      setUploadProgress(40);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('graphKnowledgeBaseId', selectedKB.id);
      formData.append('textContent', textContent);

      setUploadProgress(60);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-graph-document`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      setUploadProgress(90);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();

      toast({
        title: 'Success',
        description: `Document processed! Extracted ${result.entityCount} entities and ${result.relationshipCount} relationships.`,
      });

      setUploadProgress(100);
      await loadDocuments(selectedKB.id);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocument(file);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-6 w-6" />
          <h2 className="text-2xl font-bold">GraphRAG Knowledge Bases</h2>
        </div>
        <Dialog open={createKBOpen} onOpenChange={setCreateKBOpen}>
          <DialogTrigger asChild>
            <Button>Create New Graph KB</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Graph Knowledge Base</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newKBName}
                  onChange={(e) => setNewKBName(e.target.value)}
                  placeholder="My Graph Knowledge Base"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newKBDescription}
                  onChange={(e) => setNewKBDescription(e.target.value)}
                  placeholder="Description of this knowledge base..."
                />
              </div>
              <Button onClick={createKnowledgeBase} className="w-full">
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Knowledge Bases</h3>
          {knowledgeBases.length === 0 ? (
            <p className="text-muted-foreground text-sm">No graph knowledge bases yet. Create one to get started!</p>
          ) : (
            <div className="space-y-2">
              {knowledgeBases.map((kb) => (
                <div
                  key={kb.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedKB?.id === kb.id ? 'bg-primary/10 border-primary' : 'hover:bg-accent'
                  }`}
                  onClick={() => setSelectedKB(kb)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{kb.name}</h4>
                      {kb.description && (
                        <p className="text-sm text-muted-foreground mt-1">{kb.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteKnowledgeBase(kb.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Documents</h3>
            {selectedKB && (
              <label htmlFor="file-upload">
                <Button disabled={uploading} asChild>
                  <span>
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </span>
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.md"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {uploading && (
            <div className="mb-4">
              <Progress value={uploadProgress} />
              <p className="text-sm text-muted-foreground mt-2">
                Extracting entities and relationships...
              </p>
            </div>
          )}

          {!selectedKB ? (
            <p className="text-muted-foreground text-sm">Select a knowledge base to view documents</p>
          ) : documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No documents yet. Upload one to build your knowledge graph!</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="p-3 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{doc.filename}</h4>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Status: {doc.status}</span>
                        {doc.entity_count !== null && (
                          <span>{doc.entity_count} entities</span>
                        )}
                        {doc.relationship_count !== null && (
                          <span>{doc.relationship_count} relationships</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
