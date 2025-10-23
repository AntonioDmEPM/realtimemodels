import { Settings, Mic, FileText, Database, DollarSign, Search, Smile } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import VoiceControls from '@/components/VoiceControls';
import PromptSettings from '@/components/PromptSettings';
import { KnowledgeBaseSelector } from '@/components/KnowledgeBaseSelector';
import PricingSettings from '@/components/PricingSettings';
import SentimentIndicator from '@/components/SentimentIndicator';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown } from 'lucide-react';

interface ConfigSidebarProps {
  // Voice Controls props
  onStart: (voice: string, model: string) => Promise<void>;
  onStop: () => Promise<void>;
  isConnected: boolean;
  statusMessage: string;
  statusType: 'idle' | 'success' | 'error' | 'connecting';
  onModelChange: (model: string) => void;
  onModeChange: (mode: 'voice' | 'chat') => void;
  mode: 'voice' | 'chat';
  
  // Prompt Settings props
  onPromptChange: (prompt: string) => void;
  currentPrompt: string;
  
  // Knowledge Base props
  knowledgeBaseId: string | undefined;
  onKnowledgeBaseChange: (id: string | undefined) => void;
  
  // Pricing props
  onPricingChange: (config: any) => void;
  selectedModel: string;
  
  // Search Settings props
  searchService: 'searchapi' | 'serpapi';
  onSearchServiceChange: (service: 'searchapi' | 'serpapi') => void;
  searchTypes: {
    web: boolean;
    shopping: boolean;
    amazon: boolean;
    maps: boolean;
  };
  onSearchTypesChange: (types: any) => void;
  
  // Sentiment props
  currentSentiment: {
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    confidence: number;
    reason?: string;
  } | null;
  adaptiveTone: boolean;
  onAdaptiveToneChange: (enabled: boolean) => void;
}

export function ConfigSidebar({
  onStart,
  onStop,
  isConnected,
  statusMessage,
  statusType,
  onModelChange,
  onModeChange,
  mode,
  onPromptChange,
  currentPrompt,
  knowledgeBaseId,
  onKnowledgeBaseChange,
  onPricingChange,
  selectedModel,
  searchService,
  onSearchServiceChange,
  searchTypes,
  onSearchTypesChange,
  currentSentiment,
  adaptiveTone,
  onAdaptiveToneChange,
}: ConfigSidebarProps) {
  const { toast } = useToast();

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h3 className="font-semibold">Configuration</h3>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Voice & Model Controls */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md p-2">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  <span>Voice & Model</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="px-2">
                <VoiceControls
                  onStart={onStart}
                  onStop={onStop}
                  isConnected={isConnected}
                  statusMessage={statusMessage}
                  statusType={statusType}
                  onModelChange={onModelChange}
                  onModeChange={onModeChange}
                  mode={mode}
                />
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Prompt Settings */}
        <Collapsible defaultOpen={false} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md p-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>System Prompt</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="px-2">
                <PromptSettings
                  onPromptChange={onPromptChange}
                  currentPrompt={currentPrompt}
                />
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Knowledge Base */}
        <Collapsible defaultOpen={false} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md p-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span>Knowledge Base</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="px-2">
                <KnowledgeBaseSelector
                  value={knowledgeBaseId}
                  onChange={onKnowledgeBaseChange}
                />
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Search Settings */}
        <Collapsible defaultOpen={false} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md p-2">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span>Search Settings</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="px-2">
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="search-service">Search Service</Label>
                      <Select value={searchService} onValueChange={onSearchServiceChange}>
                        <SelectTrigger id="search-service">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="searchapi">SearchAPI (Web only)</SelectItem>
                          <SelectItem value="serpapi">SerpAPI (All features)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3">
                      <Label>Search Types</Label>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="search-web" className="cursor-pointer text-sm">Web Search</Label>
                        <Switch 
                          id="search-web" 
                          checked={searchTypes.web}
                          onCheckedChange={(checked) => onSearchTypesChange({ ...searchTypes, web: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="search-shopping" className="cursor-pointer text-sm">Google Shopping</Label>
                        <Switch 
                          id="search-shopping" 
                          checked={searchTypes.shopping}
                          onCheckedChange={(checked) => {
                            if (checked && searchService !== 'serpapi') {
                              toast({
                                title: 'SerpAPI Required',
                                description: 'Shopping search requires SerpAPI',
                                variant: 'destructive'
                              });
                              return;
                            }
                            onSearchTypesChange({ ...searchTypes, shopping: checked });
                          }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="search-amazon" className="cursor-pointer text-sm">Amazon Search</Label>
                        <Switch 
                          id="search-amazon" 
                          checked={searchTypes.amazon}
                          onCheckedChange={(checked) => {
                            if (checked && searchService !== 'serpapi') {
                              toast({
                                title: 'SerpAPI Required',
                                description: 'Amazon search requires SerpAPI',
                                variant: 'destructive'
                              });
                              return;
                            }
                            onSearchTypesChange({ ...searchTypes, amazon: checked });
                          }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="search-maps" className="cursor-pointer text-sm">Maps / Local Business</Label>
                        <Switch 
                          id="search-maps" 
                          checked={searchTypes.maps}
                          onCheckedChange={(checked) => {
                            if (checked && searchService !== 'serpapi') {
                              toast({
                                title: 'SerpAPI Required',
                                description: 'Maps search requires SerpAPI',
                                variant: 'destructive'
                              });
                              return;
                            }
                            onSearchTypesChange({ ...searchTypes, maps: checked });
                          }}
                        />
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      Shopping, Amazon, and Maps require SerpAPI
                    </p>
                  </div>
                </Card>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Sentiment & Tone */}
        <Collapsible defaultOpen={false} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md p-2">
                <div className="flex items-center gap-2">
                  <Smile className="h-4 w-4" />
                  <span>Sentiment & Tone</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="px-2">
                <Card className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="adaptive-tone" className="text-sm font-medium">
                      Adaptive Tone
                    </Label>
                    <Switch 
                      id="adaptive-tone" 
                      checked={adaptiveTone}
                      onCheckedChange={onAdaptiveToneChange}
                    />
                  </div>
                  {adaptiveTone && (
                    <p className="text-xs text-muted-foreground">
                      AI adjusts tone based on detected sentiment
                    </p>
                  )}
                  <SentimentIndicator sentiment={currentSentiment} />
                </Card>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Pricing Settings */}
        <Collapsible defaultOpen={false} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md p-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Pricing</span>
                </div>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="px-2">
                <PricingSettings
                  onPricingChange={onPricingChange}
                  selectedModel={selectedModel}
                />
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
    </Sidebar>
  );
}
