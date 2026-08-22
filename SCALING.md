# Scaling & uptime — how to keep Rankkw up under load

The app code is I/O-bound and already caches well. "Sometimes down under load" is
almost always operational, not a code bug. This is the checklist, in priority order.

## 1. Run it under PM2, not bare `next start`  ← do this first
A bare `next start` is ONE process on ONE CPU core with no restart policy. One burst
saturates the core; one crash/OOM takes the whole site down until a human restarts it.

```bash
npm run build
pm2 start ecosystem.config.js   # cluster: one worker per core, auto-restart, OOM-recycle
pm2 save                        # persist the process list
pm2 startup                     # one-time: run the command it prints so PM2 starts on boot
```

Monitor:
```bash
pm2 status          # workers, restart counts, memory, CPU
pm2 logs rankkw     # live logs — watch for [uncaughtException] / repeated [boot] (= crash loop)
```

`ecosystem.config.js` is tuned in-repo. On a small box, cap workers so nginx/Mongo keep
cores: `PM2_INSTANCES=2 pm2 start ecosystem.config.js`. Tune `PM2_MAX_MEMORY` to
`(RAM / instances) − headroom`.

## 2. Verify you're not running dev in prod
`next dev` is not for production (no optimization, heavy memory, recompiles on request)
and will fall over under load. Production must be `npm run build` then PM2 / `next start`.

## 3. MongoDB tier
The `/api/health` DB ping is a quick tell. Sub-100 ms is healthy; **hundreds of ms means a
shared/free tier (M0/M2)** that throttles under load and stalls requests. For real traffic
move to **≥ M10** (dedicated). Per-instance pool is already capped (`MONGO_MAX_POOL_SIZE`,
default 10) so `instances × 10` stays under the tier's connection limit — raise the tier
before raising the pool.

## 4. Health monitoring
`GET /api/health` → `200 {ok:true, db:'up', ms, pid}` when healthy, `503` when the DB is
unreachable (a "half-dead" worker: Node up, Mongo down). Point an uptime monitor
(UptimeRobot/BetterStack) at it, and use it as the nginx upstream health check so a bad
worker is pulled from rotation automatically.

## 5. Crash visibility
`src/instrumentation.ts` logs `[unhandledRejection]` / `[uncaughtException]` with a stack
and timestamp (production only), then exits so PM2 recycles a clean worker. Next time the
site wobbles, `pm2 logs rankkw` will show the actual cause instead of a silent death.

## 6. Redis — only once you cluster (and for one correctness fix)
Under PM2 cluster the in-memory cache / rate-limit / single-flight are per-worker:
- **Cache** duplicated per worker — harmless (bounded, `MEMCACHE_MAX_ENTRIES`, default 5000);
  costs a few extra upstream calls. Fine.
- **Rate limits** counted per worker — slightly more lenient. Acceptable; reCAPTCHA gate
  still applies.
- **Etsy token refresh** — the ONE thing that wants cross-worker coordination. Etsy refresh
  tokens are single-use; two workers refreshing the same shop at once means one loses. It
  self-heals on the next request (tokens are re-read from Mongo), so the blast radius is a
  transient, intermittent shop-widget error — not an outage.

`@upstash/redis` + `@upstash/ratelimit` are already installed. When you're ready, back
`lib/cache.ts`, the rate limiters, and the token-refresh lock (`lib/etsy-tokens.ts`) with
Upstash — set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` and the helpers switch
over, everything else is unchanged. (A Mongo-based lock on just the token refresh is a
no-new-service alternative.)

## Quick capacity math
This app spends almost all its time awaiting Mongo / Etsy / Google / Gemini, so one worker
already serves many concurrent users. `instances = cores` multiplies that. The real ceilings
you'll hit first, in order: **(a) no auto-restart → stays down after a crash** (fixed by #1),
**(b) Mongo M0/M2 throttling** (#3), **(c) upstream API rate limits / cost** (mitigated by the
shared cache — bigger with Redis, #6).
