import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Upload, FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  chunk_count: number;
  created_at: string;
}

export const KnowledgeBaseManager = () => {
  const { toast } = useToast();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form states
  const [newKBName, setNewKBName] = useState('');
  const [newKBDescription, setNewKBDescription] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

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
        .from('knowledge_bases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKnowledgeBases(data || []);
    } catch (error) {
      console.error('Error loading knowledge bases:', error);
      toast({
        title: 'Error',
        description: 'Failed to load knowledge bases',
        variant: 'destructive',
      });
    }
  };

  const loadDocuments = async (kbId: string) => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('knowledge_base_id', kbId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const createKnowledgeBase = async () => {
    if (!newKBName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the knowledge base',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('knowledge_bases')
        .insert({
          user_id: user.id,
          name: newKBName,
          description: newKBDescription || null,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Knowledge base created successfully',
      });

      setNewKBName('');
      setNewKBDescription('');
      setIsCreateDialogOpen(false);
      await loadKnowledgeBases();
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      toast({
        title: 'Error',
        description: 'Failed to create knowledge base',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteKnowledgeBase = async (kbId: string) => {
    if (!confirm('Are you sure? This will delete all documents and chunks in this knowledge base.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', kbId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Knowledge base deleted successfully',
      });

      if (selectedKB?.id === kbId) {
        setSelectedKB(null);
        setDocuments([]);
      }
      await loadKnowledgeBases();
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete knowledge base',
        variant: 'destructive',
      });
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Use the worker from the npm package
    const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    console.log(`PDF loaded: ${pdf.numPages} pages`);
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    console.log(`Extracted ${fullText.length} characters from PDF`);
    return fullText.trim();
  };

  const uploadDocument = async (file: File) => {
    if (!selectedKB) return;

    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Extract text from PDF if needed
      let textContent = '';
      if (file.type === 'application/pdf') {
        toast({
          title: 'Processing PDF',
          description: 'Extracting text from PDF...',
        });
        textContent = await extractTextFromPDF(file);
        
        if (!textContent || textContent.length < 10) {
          throw new Error('Could not extract text from PDF. The file may be scanned or empty.');
        }
      } else {
        textContent = await file.text();
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('knowledge_base_id', selectedKB.id);
      formData.append('text_content', textContent);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-document`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      if (result.chunks_processed === 0) {
        toast({
          title: 'Warning',
          description: 'Document uploaded but no chunks were processed. Check file format.',
          variant: 'destructive',
        });
      } else if (result.chunks_processed < result.total_chunks) {
        toast({
          title: 'Partial Success',
          description: `Document uploaded with ${result.chunks_processed}/${result.total_chunks} chunks processed`,
        });
      } else {
        toast({
          title: 'Success',
          description: `Document processed successfully: ${result.chunks_processed} chunks created`,
        });
      }

      setIsUploadDialogOpen(false);
      await loadDocuments(selectedKB.id);
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadDocument(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Knowledge Base Management</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Knowledge Base
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Knowledge Base</DialogTitle>
              <DialogDescription>
                Create a new knowledge base to organize your documents
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newKBName}
                  onChange={(e) => setNewKBName(e.target.value)}
                  placeholder="My Knowledge Base"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newKBDescription}
                  onChange={(e) => setNewKBDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createKnowledgeBase} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Knowledge Bases List */}
        <Card className="p-4 md:col-span-1">
          <h3 className="font-semibold mb-4">Knowledge Bases</h3>
          <div className="space-y-2">
            {knowledgeBases.map((kb) => (
              <div
                key={kb.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedKB?.id === kb.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
                onClick={() => setSelectedKB(kb)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{kb.name}</div>
                    {kb.description && (
                      <div className="text-sm opacity-80 mt-1">{kb.description}</div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
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
        </Card>

        {/* Documents List */}
        <Card className="p-4 md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">
              {selectedKB ? `Documents in ${selectedKB.name}` : 'Select a Knowledge Base'}
            </h3>
            {selectedKB && (
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>
                      Supported formats: PDF, DOCX, TXT, MD, CSV
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.csv"
                      onChange={handleFileSelect}
                      disabled={isUploading}
                    />
                    {isUploading && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing document...
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {selectedKB ? (
            <div className="space-y-2">
              {documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No documents yet. Upload your first document to get started.</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg bg-secondary flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5" />
                      <div className="flex-1">
                        <div className="font-medium">{doc.filename}</div>
                        <div className="text-sm text-muted-foreground">
                          {doc.chunk_count} chunks • {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant={
                        doc.status === 'completed' ? 'default' : 
                        doc.status === 'partial' ? 'secondary' : 
                        'destructive'
                      }
                    >
                      {doc.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Select a knowledge base to view its documents
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};