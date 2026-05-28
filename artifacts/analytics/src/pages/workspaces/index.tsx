import { useListWorkspaces, getListWorkspacesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PlusIcon, ArrowRight, BarChart2 } from "lucide-react";
import { format } from "date-fns";

export default function WorkspacesList() {
  const { data: workspaces, isLoading } = useListWorkspaces({
    query: { queryKey: getListWorkspacesQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin text-primary">
          <BarChart2 className="w-8 h-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Workspaces</h1>
            <p className="mt-2 text-sm text-gray-500">Select a workspace to view analytics or create a new one.</p>
          </div>
          <Link href="/workspaces/new">
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              New Workspace
            </Button>
          </Link>
        </div>

        {workspaces && workspaces.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Link key={ws.id} href={`/workspaces/${ws.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
                  <CardHeader>
                    <CardTitle className="group-hover:text-primary transition-colors">{ws.name}</CardTitle>
                    <CardDescription>{ws.domain}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>Created {format(new Date(ws.createdAt), 'MMM d, yyyy')}</span>
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <BarChart2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No workspaces</h3>
              <p className="text-gray-500 mb-6">Create a workspace to start tracking analytics.</p>
              <Link href="/workspaces/new">
                <Button>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Workspace
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
