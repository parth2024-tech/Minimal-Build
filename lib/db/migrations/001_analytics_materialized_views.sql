-- Analytics materialized views + indexes for CONCURRENT refresh.
-- Run once against your Postgres database:
--   psql "$DATABASE_URL" -f lib/db/migrations/001_analytics_materialized_views.sql

-- daily_sessions_mv (defined in Drizzle schema/sessions.ts)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_sessions_mv AS
SELECT
  md5(concat(workspace_id, anonymized_ip, user_agent, date_trunc('day', created_at))) AS session_hash,
  workspace_id,
  date_trunc('day', created_at) AS date,
  anonymized_ip,
  user_agent,
  min(created_at) AS start_time,
  max(created_at) AS end_time,
  count(*)::int AS event_count
FROM events
GROUP BY workspace_id, anonymized_ip, user_agent, date_trunc('day', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS daily_sessions_mv_session_hash_idx
  ON daily_sessions_mv (session_hash);

CREATE INDEX IF NOT EXISTS daily_sessions_mv_workspace_date_idx
  ON daily_sessions_mv (workspace_id, date);

-- daily_page_stats_mv
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_page_stats_mv AS
SELECT
  workspace_id,
  date_trunc('day', created_at) AS date,
  url,
  count(*)::int AS event_count
FROM events
WHERE url IS NOT NULL
GROUP BY workspace_id, date_trunc('day', created_at), url;

CREATE UNIQUE INDEX IF NOT EXISTS daily_page_stats_mv_pk_idx
  ON daily_page_stats_mv (workspace_id, date, url);

CREATE INDEX IF NOT EXISTS daily_page_stats_mv_workspace_date_idx
  ON daily_page_stats_mv (workspace_id, date);

-- daily_referrer_stats_mv
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_referrer_stats_mv AS
SELECT
  workspace_id,
  date_trunc('day', created_at) AS date,
  referrer,
  count(*)::int AS event_count
FROM events
WHERE referrer IS NOT NULL
GROUP BY workspace_id, date_trunc('day', created_at), referrer;

CREATE UNIQUE INDEX IF NOT EXISTS daily_referrer_stats_mv_pk_idx
  ON daily_referrer_stats_mv (workspace_id, date, referrer);

CREATE INDEX IF NOT EXISTS daily_referrer_stats_mv_workspace_date_idx
  ON daily_referrer_stats_mv (workspace_id, date);

-- daily_event_stats_mv
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_event_stats_mv AS
SELECT
  workspace_id,
  date_trunc('day', created_at) AS date,
  event_name,
  count(*)::int AS event_count
FROM events
GROUP BY workspace_id, date_trunc('day', created_at), event_name;

CREATE UNIQUE INDEX IF NOT EXISTS daily_event_stats_mv_pk_idx
  ON daily_event_stats_mv (workspace_id, date, event_name);

CREATE INDEX IF NOT EXISTS daily_event_stats_mv_workspace_date_idx
  ON daily_event_stats_mv (workspace_id, date);

-- pg_cron: refresh all analytics MVs every 5 minutes (requires pg_cron extension).
-- On managed Postgres, enable pg_cron in the provider dashboard first.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'refresh_analytics_mvs';

SELECT cron.schedule(
  'refresh_analytics_mvs',
  '*/5 * * * *',
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sessions_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_page_stats_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_referrer_stats_mv;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_event_stats_mv;
  $$
);
