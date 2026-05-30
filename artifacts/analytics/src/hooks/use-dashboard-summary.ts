import { useQuery } from "@tanstack/react-query";
import type {
  AnalyticsSummary,
  LiveStats,
  Segment,
  TimeseriesPoint,
  TopPage,
  TopReferrer,
} from "@workspace/api-client-react";

export type DashboardSummaryResponse = {
  summary: AnalyticsSummary;
  timeseries: TimeseriesPoint[];
  topPages: TopPage[];
  topReferrers: TopReferrer[];
  eventNames: string[];
  liveStats: LiveStats;
  segments: Segment[];
};

export type DashboardSummaryParams = {
  workspaceId: string;
  days: number;
  eventName?: string;
  segmentId?: string;
};

function buildDashboardSummaryUrl(params: DashboardSummaryParams): string {
  const search = new URLSearchParams({
    workspaceId: params.workspaceId,
    days: String(params.days),
  });
  if (params.eventName) search.set("eventName", params.eventName);
  if (params.segmentId) search.set("segmentId", params.segmentId);
  return `/api/dashboard/summary?${search.toString()}`;
}

export function getDashboardSummaryQueryKey(params: DashboardSummaryParams) {
  return ["dashboardSummary", params] as const;
}

async function fetchDashboardSummary(
  params: DashboardSummaryParams,
  signal?: AbortSignal,
): Promise<DashboardSummaryResponse> {
  const res = await fetch(buildDashboardSummaryUrl(params), {
    signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Dashboard summary failed: HTTP ${res.status}`);
  }
  return res.json() as Promise<DashboardSummaryResponse>;
}

export function useDashboardSummary(params: DashboardSummaryParams) {
  return useQuery({
    queryKey: getDashboardSummaryQueryKey(params),
    queryFn: ({ signal }) => fetchDashboardSummary(params, signal),
    enabled: Boolean(params.workspaceId),
    refetchInterval: 60_000,
  });
}
