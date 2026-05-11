const REFERRAL_STORAGE_KEY = "zuno_referral_code";
const REFERRAL_SAVED_AT_KEY = "zuno_referral_saved_at";
const LEGACY_PENDING_REFERRAL_KEY = "pending_referral";

const normalizeReferralCode = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.startsWith("ref_") ? trimmed : null;
};

export const getReferralFromSearch = (search: string | URLSearchParams) => {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return normalizeReferralCode(params.get("ref"));
};

export const saveReferralCode = (value?: string | null) => {
  const referralCode = normalizeReferralCode(value);
  if (!referralCode) return null;

  localStorage.setItem(REFERRAL_STORAGE_KEY, referralCode);
  localStorage.setItem(REFERRAL_SAVED_AT_KEY, new Date().toISOString());
  sessionStorage.setItem(REFERRAL_STORAGE_KEY, referralCode);
  localStorage.setItem(LEGACY_PENDING_REFERRAL_KEY, referralCode);

  return referralCode;
};

export const getStoredReferralCode = () =>
  normalizeReferralCode(sessionStorage.getItem(REFERRAL_STORAGE_KEY)) ||
  normalizeReferralCode(localStorage.getItem(REFERRAL_STORAGE_KEY)) ||
  normalizeReferralCode(localStorage.getItem(LEGACY_PENDING_REFERRAL_KEY));

export const getCurrentReferralCode = (search?: string | URLSearchParams) =>
  (search ? getReferralFromSearch(search) : null) || getStoredReferralCode();

export const persistReferralFromSearch = (search: string | URLSearchParams) =>
  saveReferralCode(getReferralFromSearch(search));

export const clearReferralCode = () => {
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
  localStorage.removeItem(REFERRAL_SAVED_AT_KEY);
  localStorage.removeItem(LEGACY_PENDING_REFERRAL_KEY);
  sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
};

export const appendReferralToPath = (path: string, referralCode = getCurrentReferralCode()) => {
  const code = normalizeReferralCode(referralCode);
  if (!code) return path;

  const [pathnameWithSearch, hash = ""] = path.split("#");
  const [pathname, search = ""] = pathnameWithSearch.split("?");
  const params = new URLSearchParams(search);
  params.set("ref", code);

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
};

export const shouldApplyReferralForUser = (createdAt?: string | null) => {
  if (!createdAt) return false;

  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return false;

  return Date.now() - createdAtMs < 10 * 60 * 1000;
};
