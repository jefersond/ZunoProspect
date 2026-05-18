export const CREATIVE_NAME_MAP: Record<string, string> = {
  "120246631612400725": "quem_abordar",
  "120246630603260725": "o_que_falar",

  "leads_conversas": "leads_conversas",
  "quem_abordar": "quem_abordar",
  "o_que_falar": "o_que_falar",

  "link_in_bio": "link_in_bio",
  "sem_utm_content": "sem_utm_content",
};

export function normalizeCreativeName(utmContent?: string | null): string {
  if (!utmContent || utmContent.trim() === "") {
    return "sem_utm_content";
  }

  const trimmed = utmContent.trim();
  if (CREATIVE_NAME_MAP[trimmed]) {
    return CREATIVE_NAME_MAP[trimmed];
  }

  return trimmed;
}

export function getCreativeDisplayName(utmContent?: string | null): string {
  return normalizeCreativeName(utmContent);
}
