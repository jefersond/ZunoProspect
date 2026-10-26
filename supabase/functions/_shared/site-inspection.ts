// Mitigacao temporaria de SSRF: a inspecao automatica de HTML dos sites dos leads esta suspensa.
// NAO reative antes de integrar o fetch seguro (PR #54) e validar Deno.resolveDns no Edge Runtime.
export const SITE_HTML_INSPECTION_ENABLED = false;

export interface SiteSignals {
  whatsapp_on_site: boolean | null;
  whatsapp_number: string | null;
  has_meta_pixel: boolean | null;
  has_gtag: boolean | null;
  has_gtm: boolean | null;
  instagram_url: string | null;
  email: string | null;
}

/** Sinais nao inspecionados: `null` = desconhecido, nunca "ausencia comprovada". */
export function unknownSiteSignals(): SiteSignals {
  return {
    whatsapp_on_site: null,
    whatsapp_number: null,
    has_meta_pixel: null,
    has_gtag: null,
    has_gtm: null,
    instagram_url: null,
    email: null,
  };
}

export function emptySiteSignals(): SiteSignals {
  return {
    whatsapp_on_site: false,
    whatsapp_number: null,
    has_meta_pixel: false,
    has_gtag: false,
    has_gtm: false,
    instagram_url: null,
    email: null,
  };
}

/**
 * Valor de `digital_signals` a persistir. Com a inspecao suspensa retorna `null`, e a RPC
 * (COALESCE) preserva o historico do lead em vez de sobrescreve-lo.
 */
export function digitalSignalsForPersistence(signals: SiteSignals, inspectionEnabled: boolean): SiteSignals | null {
  return inspectionEnabled ? signals : null;
}
