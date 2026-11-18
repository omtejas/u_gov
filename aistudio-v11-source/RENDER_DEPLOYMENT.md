# Render functional-demo deployment

This configuration runs the React site and Express API together as one free
Render web service. It stores temporary demo data under `/tmp/ugov-data`.

## Deploy

1. Sign in to [Render](https://dashboard.render.com/).
2. Choose **New → Blueprint** and connect the `omtejas/u_gov` GitHub repository.
3. Render detects `render.yaml`. Review it and click **Apply**.
4. Add `GEMINI_API_KEY` only if the AI assistant is required, then deploy.

The Blueprint installs development dependencies during the build because Vite's
React plugin is a build-time dependency.

Render generates `SESSION_SECRET`; never commit or paste that value publicly.

## Scope and limits

This is a temporary preview deployment. Render's free service has ephemeral
storage, so accounts, uploaded documents, applications, and other data can be
lost after a restart or redeploy. Do not use it for real citizen data. A
production release requires a PostgreSQL implementation and managed object
storage.
