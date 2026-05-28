import { useState } from "react";
import { useParams, useLocation } from "wouter";
import WorkspaceLayout from "@/components/WorkspaceLayout";
import { 
  useGetWorkspace, 
  useListApiKeys, 
  useCreateApiKey, 
  useDeleteApiKey,
  useDeleteWorkspace,
  getListApiKeysQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Key, Copy, Check, Trash2, Code } from "lucide-react";
import { format } from "date-fns";

export default function WorkspaceSettings() {
  const { workspaceId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: workspace } = useGetWorkspace(workspaceId!);
  const { data: apiKeys } = useListApiKeys(workspaceId!);
  
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();
  const deleteWorkspace = useDeleteWorkspace();

  const [newKeyName, setNewKeyName] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleCreateKey = () => {
    if (!newKeyName.trim() || !workspaceId) return;
    
    createApiKey.mutate(
      { workspaceId, data: { name: newKeyName } },
      {
        onSuccess: (res) => {
          setCreatedSecret(res.secret);
          setNewKeyName("");
          queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey(workspaceId) });
        }
      }
    );
  };

  const handleDeleteKey = (keyId: string) => {
    if (!workspaceId) return;
    deleteApiKey.mutate(
      { workspaceId, keyId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey(workspaceId) });
        }
      }
    );
  };

  const handleDeleteWorkspace = () => {
    if (!workspaceId) return;
    deleteWorkspace.mutate(
      { workspaceId },
      {
        onSuccess: () => {
          setLocation("/workspaces");
        }
      }
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const jsSnippet = `fetch('https://${workspace?.domain || 'your-domain.com'}/api/v1/event', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({ 
    workspaceId: '${workspaceId}', 
    eventName: 'pageview', 
    url: window.location.href 
  })
});`;

  if (!workspaceId) return null;

  return (
    <WorkspaceLayout workspaceId={workspaceId}>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
          <p className="text-sm text-gray-500">Manage your workspace configuration and API keys.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Workspace Details</CardTitle>
            <CardDescription>Basic information about this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Workspace ID</label>
              <div className="flex mt-1">
                <code className="bg-gray-100 px-3 py-2 rounded-l-md text-sm text-gray-800 flex-1 overflow-x-auto">
                  {workspace?.id}
                </code>
                <Button variant="outline" className="rounded-l-none border-l-0" onClick={() => copyToClipboard(workspace?.id || '')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input value={workspace?.name || ""} disabled className="mt-1 bg-gray-50" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Domain</label>
              <Input value={workspace?.domain || ""} disabled className="mt-1 bg-gray-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integration Snippet</CardTitle>
            <CardDescription>Send events directly from your client application.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                <code>{jsSnippet}</code>
              </pre>
              <Button 
                variant="secondary" 
                size="sm" 
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(jsSnippet)}
              >
                <Copy className="w-3 h-3 mr-2" />
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Keys used to authenticate requests to the ingest API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <Input 
                placeholder="New key name (e.g. Production)" 
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <Button onClick={handleCreateKey} disabled={createApiKey.isPending || !newKeyName.trim()}>
                <Key className="w-4 h-4 mr-2" />
                Create Key
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Prefix</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apiKeys?.map((key) => (
                    <tr key={key.id} className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">{key.name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{key.prefix}••••••••</td>
                      <td className="px-4 py-3 text-gray-500">
                        {format(new Date(key.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteKey(key.id)}
                          disabled={deleteApiKey.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!apiKeys || apiKeys.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No API keys found. Create one to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Destructive actions for this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Deleting this workspace will permanently remove all associated analytics data, events, and API keys. This action cannot be undone.
            </p>
            <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
              Delete Workspace
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* Secret Reveal Modal */}
      <Dialog open={!!createdSecret} onOpenChange={(open) => !open && setCreatedSecret(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Please copy your new API key secret. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-4 mb-6">
            <code className="bg-gray-100 p-3 rounded-md flex-1 text-sm font-mono overflow-x-auto break-all border">
              {createdSecret}
            </code>
            <Button size="icon" onClick={() => copyToClipboard(createdSecret || "")}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workspace?</DialogTitle>
            <DialogDescription>
              Are you absolutely sure you want to delete this workspace? All data will be permanently lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteWorkspace} disabled={deleteWorkspace.isPending}>
              {deleteWorkspace.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </WorkspaceLayout>
  );
}
