# Zuno Prospect → Zanotelli OS — internal prospecting bridge

## Purpose

This bridge exists only for Grupo Zanotelli's own prospecting workflow. It must never export ordinary SaaS customers' lead searches to Zanotelli OS.

## Entry point

`supabase/functions/zanotelli-internal-prospecting/index.ts`

The endpoint:

1. requires an authenticated user;
2. requires that user to be an administrator;
3. forces `foco = zuno_internal_prospecting` regardless of caller input;
4. forces prospecting channel selection to `email` for the search stage;
5. delegates discovery/enrichment/deduplication to the existing `buscar-leads` function;
6. reads only leads owned by the same admin and the exact returned `search_run_id` through the existing encrypted-lead RPC;
7. emits bounded `lead_snapshot` events to Zanotelli OS with an HMAC signature;
8. never arms outbound and never sends email or WhatsApp.

## Required backend secrets

All variables are server-side Supabase Edge Function secrets. Never expose them through `VITE_*` variables or frontend code.

- `ZANOTELLI_INBOUND_BRIDGE_ENABLED`
- `ZANOTELLI_INBOUND_BRIDGE_URL`
- `ZANOTELLI_INBOUND_WEBHOOK_SECRET`

The receiver URL must use HTTPS and the shared secret must contain at least 32 characters.

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

No user token, authorization header, encryption key, Supabase service role, bridge secret or customer account metadata is sent.

## Failure behavior

The bridge is fail-safe for outbound: receiving a lead does not arm any campaign. A snapshot accepted by Zanotelli enters the inbound/review path. Duplicate snapshots are treated idempotently.

A disabled or misconfigured bridge is reported as a sanitized count in the wrapper response; no fallback send path exists.

## Production activation gates

Do not deploy/enable this bridge until all of the following are intentionally approved:

1. Zanotelli inbound bridge is deployed and enabled on the target environment.
2. `integration_sources.slug = zuno-prospect` is in the intended mode.
3. Sender readiness for email is independently verified.
4. Outbound approval review is recorded in Zanotelli OS.
5. Runtime kill switch remains available.
6. Initial daily limits remain conservative.

Activation of this bridge and activation of outbound are separate decisions.
