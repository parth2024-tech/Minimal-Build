import { useLocation } from "wouter";
import { useEffect } from "react";
import { useListWorkspaces, getListWorkspacesQueryKey } from "@workspace/api-client-react";

export default function IndexPage() {
  const [, setLocation] = useLocation();
  const { data: workspaces, isLoading } = useListWorkspaces({
    query: {
      queryKey: getListWorkspacesQueryKey()
    }
  });

  useEffect(() => {
    if (!isLoading && workspaces) {
      if (workspaces.length > 0) {
        setLocation(`/workspaces/${workspaces[0].id}`);
      } else {
        setLocation("/workspaces/new");
      }
    }
  }, [isLoading, workspaces, setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
        <span className="text-sm font-medium text-muted-foreground">Loading workspaces...</span>
      </div>
    </div>
  );
}
