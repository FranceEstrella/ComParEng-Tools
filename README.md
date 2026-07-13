# ComParEng-Tools
A collection of tools designed to help Computer Engineering students at FEU Tech manage their academic journey more effectively.

## Feedback email (Mailgun)

This project can forward user feedback submitted from the homepage to an email address using Mailgun's HTTP API.

Required environment variables (server-side):

- `MAILGUN_API_KEY` - your Mailgun API key (starts with `key-...`)
- `MAILGUN_DOMAIN` - the Mailgun sending domain (e.g. `mg.example.com`)
- `SENDER_EMAIL` - optional sender address (defaults to `no-reply@compareng.app`)

How to test locally:

1. Create a `.env.local` file at the project root and add the variables above. Do NOT commit this file.
2. Restart the dev server (`next dev`).
3. Open the homepage, open the Patch Notes → Send Feedback modal, and use "Send to Server" to submit a test message.

If Mailgun is not configured, the route returns `503` and does not log the submitted message.

## API protection

The feedback and analytics endpoints enforce request-size validation, route-specific rate limits, and safe error responses.

Production deployments should configure a shared Redis-compatible REST store so limits work across serverless instances:

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or the equivalent `KV_REST_API_URL` and `KV_REST_API_TOKEN`)
- Alternatively, an Upstash `rediss://` connection string in `UPSTASH_REDIS_URL`, `KV_URL`, or `REDIS_URL`
- `RATE_LIMIT_IP_SALT` - a private random value used when hashing client IPs for limiter keys
- `ANALYTICS_KEY` - required in production to access the analytics page and reset endpoint

Without a distributed store, production API requests fail closed with `503` rather than silently falling back to per-instance limits. `RATE_LIMIT_MEMORY_FALLBACK=true` is available only as an explicit temporary emergency fallback and should not be used for normal production traffic.

## Analytics behavior

Analytics events are tracked separately from API protection and are written through the same Upstash Redis configuration when it is available.

- Client-side analytics events are batched before they are sent to `/api/analytics`.
- The analytics ingest route accepts either a single event or a batch of events.
- If Redis is configured, analytics snapshots and writes are shared through Redis; otherwise they fall back to per-instance in-memory storage.
- The analytics admin page keeps the access key only in this browser tab’s `sessionStorage`.
- On refresh, the page restores the saved key before it fetches analytics so a valid key does not flash an unauthorized state.
- The access indicator now shows `not set`, `saved`, `checking`, `connected`, or `locked` so it is clear whether the key is only stored locally or has actually been accepted by the server.
- The analytics page stops polling if the server returns `429` or `503`.
- The analytics GET path returns `401` for missing or invalid keys instead of rate-limiting auth failures.
- The analytics POST path is not throttled by route-level rate limiting, so ingestion failures now point to validation, auth, or storage issues instead of request volume.
