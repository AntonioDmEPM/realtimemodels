import { Settings, MessageSquare, Database, Search, Activity, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { id: 'session', title: 'Session', icon: Activity },
  { id: 'voice-model', title: 'Model Settings', icon: Settings },
  { id: 'system-prompt', title: 'System Prompt', icon: MessageSquare },
  { id: 'knowledge-base', title: 'Knowledge Base', icon: Database },
  { id: 'search-settings', title: 'Search Settings', icon: Search },
];

interface AppSidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isSessionActive?: boolean;
}

export function AppSidebar({ currentView, onViewChange, isSessionActive = false }: AppSidebarProps) {
  const { open } = useSidebar();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isDisabled = isSessionActive && item.id !== 'session';
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => !isDisabled && onViewChange(item.id)}
                      isActive={currentView === item.id}
                      disabled={isDisabled}
                      tooltip={isDisabled ? 'Stop the session to switch views' : item.title}
                      className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              <SidebarSeparator className="my-2" />
              
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/agents')}
                  tooltip="Multi-Agent System"
                  className="text-primary"
                >
                  <Sparkles className="h-4 w-4" />
                  {open && <span>Agents</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
