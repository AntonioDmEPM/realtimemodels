import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface SearchSettingsViewProps {
  searchService: 'searchapi' | 'serpapi';
  searchTypes: {
    web: boolean;
    shopping: boolean;
    amazon: boolean;
    maps: boolean;
  };
  onSearchServiceChange: (service: 'searchapi' | 'serpapi') => void;
  onSearchTypesChange: (types: { web: boolean; shopping: boolean; amazon: boolean; maps: boolean }) => void;
}

export function SearchSettingsView({
  searchService,
  searchTypes,
  onSearchServiceChange,
  onSearchTypesChange,
}: SearchSettingsViewProps) {
  const handleSearchTypeChange = (type: keyof typeof searchTypes, checked: boolean) => {
    onSearchTypesChange({
      ...searchTypes,
      [type]: checked,
    });
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Search Settings</h1>
          <p className="text-muted-foreground">Configure web search capabilities for the AI assistant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="searchService">Search Provider</Label>
              <Select value={searchService} onValueChange={onSearchServiceChange}>
                <SelectTrigger id="searchService">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="searchapi">SearchAPI</SelectItem>
                  <SelectItem value="serpapi">SerpAPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="web"
                  checked={searchTypes.web}
                  onCheckedChange={(checked) => handleSearchTypeChange('web', checked as boolean)}
                />
                <Label htmlFor="web" className="cursor-pointer">Web Search</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="shopping"
                  checked={searchTypes.shopping}
                  onCheckedChange={(checked) => handleSearchTypeChange('shopping', checked as boolean)}
                />
                <Label htmlFor="shopping" className="cursor-pointer">Shopping Search</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="amazon"
                  checked={searchTypes.amazon}
                  onCheckedChange={(checked) => handleSearchTypeChange('amazon', checked as boolean)}
                />
                <Label htmlFor="amazon" className="cursor-pointer">Amazon Search</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="maps"
                  checked={searchTypes.maps}
                  onCheckedChange={(checked) => handleSearchTypeChange('maps', checked as boolean)}
                />
                <Label htmlFor="maps" className="cursor-pointer">Maps Search</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
