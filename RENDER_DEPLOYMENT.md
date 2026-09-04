# Render functional-demo deployment

This configuration runs the React site and Express API together as one Render
web service. It stores the JSON demo database and uploaded document vault on a
single persistent disk at `/var/data`, so they survive restarts and redeploys.

## Deploy

1. Sign in to [Render](https://dashboard.render.com/).
2. Choose **New → Blueprint** and connect the `omtejas/u_gov` GitHub repository.
3. Render detects `render.yaml`. Review it and click **Apply**.
4. Add `GEMINI_API_KEY` only if the AI assistant is required, then deploy.

Render generates `SESSION_SECRET`; never commit or paste that value publicly.

## Scope and limits

This is a functional single-instance demo deployment. The persistent disk keeps
the JSON store and files, but it does not provide database-level concurrency,
backups, user-data governance, or multi-instance scaling. Do not use it for
real citizen data. A production release requires a PostgreSQL implementation
and managed object storage.
