# Meridian

Two apps, one business. Core is the workspace (invoices, banking, contacts). Reporting is the separate reports app. They share a shell and an AI assistant, and they drift on purpose so a governed fix can land in one place without rewriting the other.

The books on screen are synthetic. The business is Harbour Studio.

## Run

```bash
npm install --prefix apps/core
npm install --prefix apps/reporting
cp apps/core/.env.example apps/core/.env.local
cp apps/core/.env.example apps/reporting/.env.local

MERIDIAN_BFF_DEMO_TOKEN=local-demo-token-change-me npm run api:core
MERIDIAN_BFF_DEMO_TOKEN=local-demo-token-change-me npm run api:reporting
npm run dev:core
npm run dev:reporting
```

Core is [http://localhost:3000](http://localhost:3000). Reports is [http://localhost:3001](http://localhost:3001). The core BFF is on port 4000 and the reporting BFF is on port 4001. The Vite dev servers inject the token, so the browser never sees it.

`Reports` in the core nav opens the reporting app. The assistant answers in core. In reporting, the same control is the known gap: it signals the workflow service and does not answer.

## Checks

```bash
npm test
npm run build
```
