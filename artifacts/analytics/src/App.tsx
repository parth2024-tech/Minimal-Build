import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import IndexPage from "@/pages/index";
import WorkspacesList from "@/pages/workspaces/index";
import WorkspaceNew from "@/pages/workspaces/new";
import WorkspaceDashboard from "@/pages/workspaces/dashboard";
import WorkspaceSettings from "@/pages/workspaces/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={IndexPage} />
      <Route path="/workspaces" component={WorkspacesList} />
      <Route path="/workspaces/new" component={WorkspaceNew} />
      <Route path="/workspaces/:workspaceId" component={WorkspaceDashboard} />
      <Route path="/workspaces/:workspaceId/settings" component={WorkspaceSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
