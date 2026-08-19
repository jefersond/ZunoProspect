# Zuno Prospect → Zanotelli OS — internal prospecting bridge

## Purpose

This bridge exists only for Grupo Zanotelli's own prospecting workflow. It must never export ordinary SaaS customers' lead searches to Zanotelli OS.

The bridge supports both the existing authenticated admin UI path and a narrowly scoped machine path so Zanotelli OS can ask Zuno Prospect to run a fresh internal prospecting search without storing the administrator password or a long-lived browser session.

## Entry point

`supabase/functions/zanotelli-internal-prospecting/index.ts`

The endpoint:

1. accepts either an authenticated Zuno administrator JWT or a Zuno machine API key;
2. for machine calls, requires an active API key owned by the designated internal ADM account with scope `prospecting:execute`;
3. requires `Idempotency-Key` on every machine call and enforces a bounded per-key RPM limit;
4. forces `foco = zuno_internal_prospecting` regardless of caller input;
5. forces prospecting channel selection to `email` for the search stage;
6. delegates discovery/enrichment/deduplication to the existing JWT-only `buscar-leads` function;
7. reads only leads owned by the same admin and the exact returned `search_run_id` through the existing encrypted-lead RPC;
8. emits bounded `lead_snapshot` events to Zanotelli OS with an HMAC signature;
9. never arms outbound and never sends email or WhatsApp.

## Machine authentication

The gateway setting for this endpoint is `verify_jwt = false` **only because the function implements its own dual authentication**. The handler still rejects unauthenticated requests.

Machine API keys:

- use the existing `zuno_...` hashed-key registry;
- must be active and unexpired;
- must be owned by the designated internal ADM account;
- must contain `prospecting:execute`;
- should contain no unrelated scopes;
- are rate-limited using the existing `api_logs` ledger;
- require a stable `Idempotency-Key`, namespaced by the endpoint before storage.

The mature `buscar-leads` endpoint remains JWT-only. For a valid machine request, the bridge uses Supabase Auth admin link generation to create a one-request delegated JWT for the API-key owner, verifies the token hash server-side, and discards the session after the request. No password or persistent refresh token is stored by the bridge.

The machine API key itself is never forwarded to `buscar-leads`, Google, or Zanotelli OS.

## Search request

The caller supplies only search criteria such as:

- `cidade`;
- `estado`;
- `pais` when applicable;
- `nicho`;
- `quantidade` (bounded to 1–25);
- optional proximity fields already understood by `buscar-leads`.

The caller cannot override the internal focus or enable WhatsApp/Instagram prospecting channels through this endpoint.

## Required backend secrets

All variables are server-side Supabase Edge Function secrets. Never expose them through `VITE_*` variables or frontend code.

- `ZANOTELLI_INBOUND_BRIDGE_ENABLED`
- `ZANOTELLI_INBOUND_BRIDGE_URL`
- `ZANOTELLI_INBOUND_WEBHOOK_SECRET`

The receiver URL must use HTTPS and the shared secret must contain at least 32 characters.

The machine API key is stored only on the Zanotelli OS backend/Vault. Zuno Prospect stores only its SHA-256 hash in `api_keys`.

## Signature contract

Headers:

- `x-zuno-timestamp`
- `x-zuno-signature`
- `x-zuno-event-id`

Signature input:

`<timestamp>.<raw-json-body>`

Algorithm: HMAC SHA-256.

## Privacy boundary

A lead snapshot can include only the public/prospecting fields already available to the internal admin search:

- external lead ID;
- company name;
- city;
- business category;
- website;
- public email;
- public phone;
- Instagram URL;
- external status;
- search run ID and Google Place ID as metadata.

No user token, authorization header, encryption key, Supabase service role, machine API key, bridge secret or customer account metadata is sent.

## Failure behavior

The bridge is fail-safe for outbound: receiving a lead does not arm any campaign. A snapshot accepted by Zanotelli enters the inbound/review path. Duplicate snapshots are treated idempotently.

A disabled or misconfigured bridge is reported as a sanitized count in the wrapper response; no fallback send path exists.

Machine retries with the same `Idempotency-Key` and same payload replay the prior successful response rather than purchasing another Google Places search. Reusing the same key with a different payload is rejected.

## Production activation gates

Deploying the bridge and activating outbound are separate decisions. A deployed bridge remains unable to execute machine searches until a dedicated scoped API key exists on Zuno and is stored server-side on Zanotelli OS.

Before real automated sourcing, intentionally verify:

1. Zanotelli inbound bridge is deployed and enabled on the target environment.
2. `integration_sources.slug = zuno-prospect` is in the intended mode.
3. The dedicated Zuno machine API key belongs to the internal ADM account and has only `prospecting:execute`.
4. Sender readiness for email is independently verified.
5. Outbound approval review is recorded in Zanotelli OS.
6. Runtime kill switch remains available.
7. Initial daily limits remain conservative.

A successful Zuno search or accepted lead snapshot never arms outbound by itself.