# Zuno Prospect → Zanotelli OS — internal prospecting bridge

## Purpose

This integration exists only for Grupo Zanotelli's own prospecting workflow. It must never export ordinary SaaS customers' searches to Zanotelli OS.

The architecture deliberately separates the human admin path from the machine path.

## Human admin path

`supabase/functions/zanotelli-internal-prospecting/index.ts`

- normal Supabase JWT verification;
- admin-only;
- forces `foco = zuno_internal_prospecting`;
- forces the search stage to email;
- reuses the mature `buscar-leads` function;
- exports only the exact search run owned by the authenticated admin;
- never arms outbound or sends email/WhatsApp.

The shared bridge helper used by this legacy/admin wrapper remains opt-in through server-side environment configuration.

## Zanotelli OS machine path

`supabase/functions/zanotelli-machine-prospecting/index.ts`

This is the only endpoint intended for automatic sourcing from Zanotelli OS.

It:

1. rejects browser requests carrying `Origin`;
2. requires a `zuno_...` API key whose SHA-256 hash exists in `api_keys`;
3. binds the key to the exact internal ADM user and email;
4. requires the key to contain **only** `prospecting:execute`;
5. enforces a maximum of 2 requests/minute;
6. requires `Idempotency-Key` before any paid search;
7. caps each request at 5 leads;
8. forces `foco = zuno_internal_prospecting` and `canaisProspeccao = ['email']`;
9. creates a one-request delegated JWT so the mature JWT-only `buscar-leads` path is reused without storing an admin password or long-lived refresh token;
10. reads only the exact search run owned by the internal ADM;
11. derives the inbound signing secret in request memory from the machine key using the domain-separated input `zanotelli-inbound-hmac:v1:<machine-key>`;
12. emits signed lead snapshots only to the pinned Zanotelli OS receiver;
13. never calls Instantly, Meta/WhatsApp or any outbound provider.

The machine key plaintext is stored only in the Zanotelli OS backend Vault. Zuno Prospect stores only its SHA-256 hash in the existing `api_keys` registry.

## Machine request

The machine endpoint accepts only bounded search criteria already understood by `buscar-leads`:

- `cidade`;
- `estado`;
- `pais` (`BR` or `US`);
- `nicho`;
- `quantidade` (1–5);
- optional proximity fields already supported by the mature search.

The caller cannot override the internal focus or enable WhatsApp/Instagram prospecting channels.

## Signature contract

Headers sent to Zanotelli OS:

- `x-zuno-timestamp`
- `x-zuno-signature`
- `x-zuno-event-id`

Signature input:

`<timestamp>.<raw-json-body>`

Algorithm: HMAC SHA-256.

## Privacy boundary

A lead snapshot can contain only public/prospecting fields already available to the internal admin search:

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

No user JWT, authorization header, encryption key, Supabase service role, machine API key or customer account metadata is sent to Zanotelli OS.

## Idempotency and failure behavior

Machine retries with the same `Idempotency-Key` and the same payload replay the prior response instead of buying another Google Places search. Reusing the key with a different payload is rejected.

A successful search or accepted snapshot does not arm outbound. Contact eligibility remains a separate Zanotelli OS decision.

## Production activation gates

Deploying the machine bridge and enabling automatic sourcing are separate decisions. Before real automated sourcing, intentionally verify:

1. Zanotelli inbound HMAC bridge is deployed and enabled.
2. `integration_sources.slug = zuno-prospect` is intentionally switched from `sandbox` to `active`.
3. The dedicated machine key belongs to the internal ADM and has only `prospecting:execute`.
4. The Zanotelli sourcing target (state, city and niche) is explicitly configured by the owner.
5. The sourcing kill switch is enabled only after those checks.
6. Email sender readiness is independently verified before outbound is armed.
7. Email contact eligibility is approved separately for each real lead.
8. WhatsApp authorization remains separate from email eligibility.

A successful Zuno search or accepted lead snapshot never grants email or WhatsApp contact permission by itself.