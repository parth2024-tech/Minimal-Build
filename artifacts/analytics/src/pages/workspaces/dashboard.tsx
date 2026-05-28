import { useState } from "react";
import { useParams } from "wouter";
import WorkspaceLayout from "@/components/WorkspaceLayout";
import { 
  useGetAnalyticsSummary, 
  useGetTimeseries, 
  useGetTopPages, 
  useGetTopReferrers, 
  useGetEventNames, 
  useGetLiveStats 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart2, Users, Activity, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function WorkspaceDashboard() {
  const { workspaceId } = useParams();
  const [days, setDays] = useState<number>(30);
  const [eventName, setEventName] = useState<string>("all");

  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary({ workspaceId: workspaceId!, days });
  const { data: timeseries } = useGetTimeseries({ workspaceId: workspaceId!, days, eventName: eventName === "all" ? undefined : eventName });
  const { data: topPages } = useGetTopPages({ workspaceId: workspaceId!, days, limit: 10 });
  const { data: topReferrers } = useGetTopReferrers({ workspaceId: workspaceId!, days, limit: 10 });
  const { data: eventNames } = useGetEventNames({ workspaceId: workspaceId! });
  const { data: liveStats } = useGetLiveStats({ workspaceId: workspaceId! }, { query: { refetchInterval: 10000 } });

  if (!workspaceId) return null;

  return (
    <WorkspaceLayout workspaceId={workspaceId}>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Overview</h1>
            <p className="text-sm text-gray-500">Monitor your workspace traffic and events.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {liveStats && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-sm font-medium">{liveStats.eventsLast5Min} events past 5m</span>
              </div>
            )}

            <Select value={eventName} onValueChange={setEventName}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {eventNames?.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={days.toString()} onValueChange={(val) => setDays(parseInt(val))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="30 Days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Events</p>
                  <h3 className="text-3xl font-bold text-gray-900">
                    {loadingSummary ? "-" : summary?.totalEvents.toLocaleString()}
                  </h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <BarChart2 className="w-6 h-6 text-primary" />
                </div>
              </div>
              {summary?.changePercent !== undefined && (
                <div className="mt-4 flex items-center gap-1 text-sm">
                  {summary.changePercent > 0 ? (
                    <span className="text-green-600 flex items-center"><TrendingUp className="w-4 h-4 mr-1" />+{summary.changePercent}%</span>
                  ) : summary.changePercent < 0 ? (
                    <span className="text-red-600 flex items-center"><TrendingDown className="w-4 h-4 mr-1" />{summary.changePercent}%</span>
                  ) : (
                    <span className="text-gray-500">0% change</span>
                  )}
                  <span className="text-gray-400 ml-1">vs previous period</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Unique Pages</p>
                  <h3 className="text-3xl font-bold text-gray-900">
                    {loadingSummary ? "-" : summary?.uniquePages.toLocaleString()}
                  </h3>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Top Event</p>
                  <h3 className="text-xl font-bold text-gray-900 truncate max-w-[150px]">
                    {loadingSummary ? "-" : (summary?.topEventName || "None")}
                  </h3>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Events Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {timeseries && timeseries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                    />
                    <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available for this period.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPages?.map((page, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="truncate pr-4 text-sm font-medium text-gray-700">
                      {page.url.replace(/^https?:\/\//, '')}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                      {page.count.toLocaleString()}
                    </div>
                  </div>
                ))}
                {(!topPages || topPages.length === 0) && (
                  <div className="text-sm text-muted-foreground text-center py-4">No pages recorded yet.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Referrers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topReferrers?.map((ref, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="truncate pr-4 text-sm font-medium text-gray-700">
                      {ref.referrer || "Direct / None"}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                      {ref.count.toLocaleString()}
                    </div>
                  </div>
                ))}
                {(!topReferrers || topReferrers.length === 0) && (
                  <div className="text-sm text-muted-foreground text-center py-4">No referrers recorded yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </WorkspaceLayout>
  );
}
