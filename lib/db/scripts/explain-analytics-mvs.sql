-- Verify dashboard queries hit materialized views, not the raw events table.
-- Usage: psql "$DATABASE_URL" -f lib/db/scripts/explain-analytics-mvs.sql
-- Replace :workspace_id with a real UUID before running.

\set workspace_id '00000000-0000-0000-0000-000000000001'

\echo '--- summary (daily_sessions_mv) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT coalesce(sum(event_count), 0)::int
FROM daily_sessions_mv
WHERE workspace_id = :'workspace_id'::uuid
  AND date >= now() - interval '30 days';

\echo '--- timeseries (daily_sessions_mv) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT date::date::text, coalesce(sum(event_count), 0)::int
FROM daily_sessions_mv
WHERE workspace_id = :'workspace_id'::uuid
  AND date >= now() - interval '30 days'
GROUP BY date
ORDER BY date;

\echo '--- top pages (daily_page_stats_mv) ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT url, sum(event_count)::int
FROM daily_page_stats_mv
WHERE workspace_id = :'workspace_id'::uuid
  AND date >= now() - interval '30 days'
GROUP BY url
ORDER BY sum(event_count) DESC
LIMIT 10;

\echo '--- retention (daily_sessions_mv) ---'
EXPLAIN (ANALYZE, BUFFERS)
WITH cohort AS (
  SELECT anonymized_ip, MIN(date) AS cohort_date
  FROM daily_sessions_mv
  WHERE workspace_id = :'workspace_id'::uuid AND date >= now() - interval '7 days'
  GROUP BY anonymized_ip
)
SELECT count(*) FROM cohort;
