import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Menu, LogOut, User, Trash2, Shield, Database, Network } from "lucide-react";
import { SessionStats, PricingConfig } from "@/utils/webrtcAudio";
import { TimelineSegment } from "@/components/ConversationTimeline";
import { TokenDataPoint } from "@/components/TokenDashboard";
import { useNavigate } from "react-router-dom";

interface SavedSession {
  id: string;
  created_at: string;
  name: string;
  model: string;
  voice: string;
  bot_prompt: string;
  knowledge_base_id?: string | null;
  pricing_config: PricingConfig;
  session_stats: SessionStats;
  timeline_segments: TimelineSegment[];
  token_data_points: TokenDataPoint[];
  events: any[];
  session_start_time: number | null;
  session_end_time: number | null;
  duration_ms: number | null;
}

interface HeaderMenuProps {
  userEmail: string;
  onLogout: () => void;
  onLoadSession: (session: SavedSession) => void;
  isConnected: boolean;
}

export default function HeaderMenu({
  userEmail,
  onLogout,
  onLoadSession,
  isConnected,
}: HeaderMenuProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadSessions();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    setIsAdmin(roles?.some(r => r.role === 'admin') || false);
  };

  const loadSessions = async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive",
      });
      return;
    }

    setSessions((data || []) as unknown as SavedSession[]);
  };

  const deleteSession = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const { error } = await supabase.from("sessions").delete().eq("id", id);

    if (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Error",
        description: "Failed to delete session",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Session deleted successfully",
    });

    loadSessions();
  };

  const loadSession = (session: SavedSession) => {
    if (isConnected) {
      toast({
        title: "Warning",
        description: "Please disconnect current session before loading a saved one",
        variant: "destructive",
      });
      return;
    }

    onLoadSession(session);
    setIsOpen(false);
    toast({
      title: "Success",
      description: "Session loaded successfully",
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 bg-background z-50">
        <DropdownMenuLabel className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Profile</span>
            <span className="text-xs text-muted-foreground font-normal">
              {userEmail}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Saved Sessions</DropdownMenuLabel>
        <ScrollArea className="h-[300px]">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No saved sessions found
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {sessions.map((session) => (
                <DropdownMenuItem
                  key={session.id}
                  className="cursor-pointer p-0"
                  onSelect={() => loadSession(session)}
                  disabled={isConnected}
                >
                  <Card className="w-full border-0 shadow-none hover:bg-accent">
                    <CardHeader className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <CardTitle className="text-sm truncate">
                            {session.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {new Date(session.created_at).toLocaleString()}
                          </CardDescription>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div className="truncate">Model: {session.model}</div>
                            <div className="truncate">Voice: {session.voice}</div>
                            <div>
                              Cost: ${session.session_stats.totalCost.toFixed(4)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={(e) => deleteSession(session.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => {
            navigate('/knowledge-base');
            setIsOpen(false);
          }} 
          className="cursor-pointer"
        >
          <Database className="mr-2 h-4 w-4" />
          <span>Vector Knowledge Base</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => {
            navigate('/graph-knowledge-base');
            setIsOpen(false);
          }} 
          className="cursor-pointer"
        >
          <Network className="mr-2 h-4 w-4" />
          <span>GraphRAG Knowledge Base</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isAdmin && (
          <>
            <DropdownMenuItem 
              onClick={() => {
                navigate('/admin');
                setIsOpen(false);
              }} 
              className="cursor-pointer"
            >
              <Shield className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
