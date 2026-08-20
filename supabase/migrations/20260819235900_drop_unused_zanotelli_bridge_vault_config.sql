begin;

-- The dedicated machine endpoint derives the inbound HMAC from the scoped
-- machine key in request memory. The earlier per-user Vault config is no longer
-- part of the production route, so remove the unused control plane rather than
-- carrying two sources of truth.
drop function if exists public.internal_read_zanotelli_bridge_config(uuid);
drop table if exists public.zanotelli_internal_bridge_config;
drop function if exists public.set_zanotelli_internal_bridge_config_updated_at();

commit;