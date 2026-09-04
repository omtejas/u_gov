# Netlify deployment

This project deploys its Vite client as a static site and runs the existing
Express API as a Netlify Function. `netlify.toml` handles both the API proxy
and the SPA fallback, so browser routes such as `/dashboard` continue to work
after a page refresh.

## Deploy settings

Netlify reads the repository configuration automatically. If entering settings
manually, use:

- Build command: `npm run build:client`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node version: `22`

## Required environment variables

Set these in **Site configuration → Environment variables** before publishing:

- `NODE_ENV=production`
- `DATABASE_URL` — a production database connection string
- `SESSION_SECRET` — a long, unique random value
- `GEMINI_API_KEY` — only when enabling the AI assistant

Do not set `ALLOW_JSON_DB_IN_PROD` in Netlify. The JSON database and local
document vault included in this repository are development-only filesystem
storage; serverless files are not durable between requests. A production
release needs the configured persistent database and object storage adapters
implemented before it can safely store citizen accounts or documents.
