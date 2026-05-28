import { useState } from "react";
import { useParams, useLocation } from "wouter";
import WorkspaceLayout from "@/components/WorkspaceLayout";
import { 
  useGetWorkspace, 
  useListApiKeys, 
  useCreateApiKey, 
  useDeleteApiKey,
  useDeleteWorkspace,
  useListSegments,
  useCreateSegment,
  useDeleteSegment,
  useListAuditLogs,
  useDeleteWorkspaceData,
  getListApiKeysQueryKey,
  getListSegmentsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, Copy, Check, Trash2, Code, Plus, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type SegmentCondition = {
  field: "url" | "referrer" | "event_name" | "user_agent";
  op: "contains" | "not_contains" | "equals" | "not_equals" | "starts_with";
  value: string;
};

export default function WorkspaceSettings() {
  const { workspaceId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: workspace } = useGetWorkspace(workspaceId!);
  const { data: apiKeys } = useListApiKeys(workspaceId!);
  const { data: segments } = useListSegments(workspaceId!);
  const { data: auditLogs } = useListAuditLogs({ workspaceId: workspaceId!, limit: 50 });
  
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();
  const deleteWorkspace = useDeleteWorkspace();
  const createSegment = useCreateSegment();
  const deleteSegment = useDeleteSegment();
  const deleteWorkspaceData = useDeleteWorkspaceData();

  const [newKeyName, setNewKeyName] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // GDPR state
  const [gdprDeleteOpen, setGdprDeleteOpen] = useState(false);
  const [gdprDeleteType, setGdprDeleteType] = useState<"30days" | "all" | null>(null);

  // Segment state
  const [segmentName, setSegmentName] = useState("");
  const [segmentConditions, setSegmentConditions] = useState<SegmentCondition[]>([
    { field: "url", op: "contains", value: "" }
  ]);

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

  const handleCreateSegment = () => {
    if (!workspaceId || !segmentName.trim() || segmentConditions.length === 0) return;
    
    createSegment.mutate(
      { workspaceId, data: { name: segmentName, conditions: segmentConditions as any } },
      {
        onSuccess: () => {
          setSegmentName("");
          setSegmentConditions([{ field: "url", op: "contains", value: "" }]);
          queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey(workspaceId) });
          toast({ title: "Segment created", description: "Your custom segment has been saved." });
        }
      }
    );
  };

  const handleDeleteSegment = (segmentId: string) => {
    if (!workspaceId) return;
    deleteSegment.mutate(
      { workspaceId, segmentId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey(workspaceId) });
          toast({ title: "Segment deleted" });
        }
      }
    );
  };

  const handleGdprDelete = () => {
    if (!workspaceId || !gdprDeleteType) return;

    deleteWorkspaceData.mutate(
      { 
        workspaceId, 
        data: gdprDeleteType === "30days" ? { olderThanDays: 30 } : {} 
      },
      {
        onSuccess: (result) => {
          setGdprDeleteOpen(false);
          setGdprDeleteType(null);
          toast({ 
            title: "Data deleted successfully", 
            description: `Deleted ${result.deletedCount.toLocaleString()} events.` 
          });
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

        {/* Segments */}
        <Card>
          <CardHeader>
            <CardTitle>Segments</CardTitle>
            <CardDescription>Create filters to analyze specific subsets of traffic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border rounded-md bg-gray-50/50 space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Create New Segment</h4>
              <Input 
                placeholder="Segment name (e.g. Mobile Users)" 
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
              />
              
              <div className="space-y-2">
                {segmentConditions.map((cond, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select 
                      value={cond.field} 
                      onValueChange={(val: any) => {
                        const newC = [...segmentConditions];
                        newC[index].field = val;
                        setSegmentConditions(newC);
                      }}
                    >
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="referrer">Referrer</SelectItem>
                        <SelectItem value="event_name">Event Name</SelectItem>
                        <SelectItem value="user_agent">User Agent</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select 
                      value={cond.op} 
                      onValueChange={(val: any) => {
                        const newC = [...segmentConditions];
                        newC[index].op = val;
                        setSegmentConditions(newC);
                      }}
                    >
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">contains</SelectItem>
                        <SelectItem value="not_contains">does not contain</SelectItem>
                        <SelectItem value="equals">equals</SelectItem>
                        <SelectItem value="not_equals">does not equal</SelectItem>
                        <SelectItem value="starts_with">starts with</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input 
                      placeholder="Value" 
                      value={cond.value}
                      onChange={(e) => {
                        const newC = [...segmentConditions];
                        newC[index].value = e.target.value;
                        setSegmentConditions(newC);
                      }}
                      className="flex-1"
                    />

                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setSegmentConditions(segmentConditions.filter((_, i) => i !== index))}
                      disabled={segmentConditions.length === 1}
                    >
                      <Trash2 className="w-4 h-4 text-gray-500" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSegmentConditions([...segmentConditions, { field: "url", op: "contains", value: "" }])}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Condition
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleCreateSegment}
                  disabled={!segmentName.trim() || createSegment.isPending}
                >
                  Save Segment
                </Button>
              </div>
            </div>

            {segments && segments.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Conditions</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {segments.map((seg) => (
                      <tr key={seg.id} className="bg-white">
                        <td className="px-4 py-3 font-medium text-gray-900">{seg.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {seg.conditions.map((c: any, i: number) => (
                            <div key={i}>{c.field} {c.op.replace('_', ' ')} "{c.value}"</div>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteSegment(seg.id)}
                            disabled={deleteSegment.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Data Retention (GDPR)
            </CardTitle>
            <CardDescription>Manage user data retention and deletion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              To comply with GDPR or other privacy regulations, you can permanently delete event data from this workspace.
            </p>
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="text-destructive hover:bg-destructive/10"
                onClick={() => { setGdprDeleteType("30days"); setGdprDeleteOpen(true); }}
              >
                Delete events older than 30 days
              </Button>
              <Button 
                variant="destructive"
                onClick={() => { setGdprDeleteType("all"); setGdprDeleteOpen(true); }}
              >
                Delete all event data
              </Button>
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

        {/* Audit Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>Recent actions performed in this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    <th className="px-4 py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auditLogs?.map((log) => (
                    <tr key={log.id} className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">{log.action}</td>
                      <td className="px-4 py-3 text-gray-500">{log.actor}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono max-w-xs truncate">
                        {log.meta ? JSON.stringify(log.meta) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                  {(!auditLogs || auditLogs.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No audit logs available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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

      {/* Delete Workspace Confirmation Modal */}
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

      {/* GDPR Data Deletion Confirmation Modal */}
      <Dialog open={gdprDeleteOpen} onOpenChange={setGdprDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Data Deletion</DialogTitle>
            <DialogDescription>
              {gdprDeleteType === "30days" 
                ? "Are you sure you want to delete all events older than 30 days? This action cannot be undone and will affect your historical analytics." 
                : "Are you sure you want to delete ALL event data? This will clear your entire analytics history but preserve your workspace and API keys. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setGdprDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleGdprDelete} disabled={deleteWorkspaceData.isPending}>
              {deleteWorkspaceData.isPending ? "Deleting..." : "Confirm Deletion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </WorkspaceLayout>
  );
}
