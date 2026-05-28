import { Link, useLocation } from "wouter";
import { LayoutDashboard, Settings, Globe, LogOut } from "lucide-react";
import { useGetWorkspace } from "@workspace/api-client-react";

interface WorkspaceLayoutProps {
  workspaceId: string;
  children: React.ReactNode;
}

export default function WorkspaceLayout({ workspaceId, children }: WorkspaceLayoutProps) {
  const [location] = useLocation();
  const { data: workspace } = useGetWorkspace(workspaceId);

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded">
              <Globe className="w-5 h-5" />
            </div>
            <span className="font-semibold tracking-tight text-sidebar-foreground">PrivatePulse</span>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Workspace
          </div>
          <div className="px-3 py-2 truncate text-sm font-medium text-sidebar-foreground">
            {workspace?.name || "Loading..."}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <Link
            href={`/workspaces/${workspaceId}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location === `/workspaces/${workspaceId}`
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/settings`}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location === `/workspaces/${workspaceId}/settings`
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </nav>

        <div className="p-4">
          <Link
            href="/workspaces"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Switch Workspace
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
