# CLAUDE.md — Kashew CRM

> ⚠️ **This session works on KASHEW ONLY.**
> This is a **simplified fork** of the Maximoney CRM, for the Kashew loan app.
> Do **not** edit or deploy any other brand from here. Maximoney CRM is a
> **separate repo** (`whatsapp-crm`) in a separate folder (`../Whatsapp CRM/`)
> with its own session. Changes here do NOT propagate to Maximoney (independent
> forks) — and Maximoney changes do not flow here unless ported manually.

## Identity

| | |
|---|---|
| App | **Kashew CRM** (simplified) |
| Repo | `github.com/wealthhero21-art/kashew-crm` |
| Live URL | https://crm.kashewapp.in |
| WhatsApp number | Reuses the Maximoney number **for now** (own number pending) |

## How this differs from Maximoney (the simplifications)

- **Dropped**: Integrations + outbound-webhooks admin, and the multi-brand
  WhatsApp-numbers admin (single number).
- **Kept**: leads, chat inbox, document workflow, OTP login, phone masking,
  quick-replies, internal notes, voice notes, light/dark themes.

## What this is

Self-hosted WhatsApp CRM for a loan app. Direct Meta WhatsApp Cloud API (no BSP).
Monorepo:
- `apps/backend` — Fastify + TypeScript + Postgres (`pg`), BullMQ (Redis), SSE
- `apps/frontend` — React + Vite SPA (served by Caddy in prod)
- `packages/shared` — shared types

Auth = WhatsApp OTP → JWT. Roles: admin, agent (scoped per lead-source).

## Hosting / deploy

Shared Contabo VPS under **Coolify** (same box as Maximoney, isolated app + DB).
Deploy = push to `main`, trigger Coolify deploy via API. Migrations auto-run on
boot. In `docker-compose.coolify.yml` the backend service is named **`kbackend`**
(app-unique) to avoid DNS collisions with other brands on the shared `coolify`
network — keep names app-unique for anything on that network.

**Server access, Coolify API token, per-app UUID + DB name, Meta creds** are NOT
in this repo. See:
`~/Desktop/Value Garage/contabo/shared-infra.md` and
`~/Desktop/Value Garage/contabo/.secrets/app-handoff-credentials.md`.

## ⚠️ Inbound caveat (while reusing Maximoney's number)

A WhatsApp number has one webhook callback URL. It points at Maximoney, so
inbound customer replies land in the **Maximoney** CRM, not Kashew. Outbound +
OTP work. Kashew needs its **own** WhatsApp number before real customer use.

## Conventions

- Run `tsc --noEmit` for both apps before deploying. Never commit secrets.
- New DB changes = new file in `apps/backend/src/db/migrations/` (auto-applied).
