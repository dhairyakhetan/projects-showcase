# logger worker

Committed copy of the worker deployed at `logger.dhairyaplayz97.workers.dev`.
Editing files here does not deploy anything.

```bash
wrangler secret put GITHUB_TOKEN   # optional, raises the GitHub API rate limit
wrangler deploy
```

`worker.js` syncs each entry in `PROJECTS` into KV once a day, resolves every
repo's `og:image` off its live site, and serves the result with an ETag.
`/admin-panel` shows per-project sync state and the raw KV keys.

**Before deploying:** set the real KV namespace id in `wrangler.toml`. The
`crons` trigger there is new — the `scheduled` handler has always existed but
never fired, so data only refreshed when a visitor happened to arrive after the
24h window lapsed.
