export const ADMIN_EMAIL = "jeferson.zanotell@gmail.com";
export const LEGACY_ADMIN_EMAIL = "jefeson.zanotell@gmail.com";
export const NEW_ADMIN_EMAIL = "falecom@klsalescompany.com";
export const NEW_LEGACY_ADMIN_EMAIL = "kiefferlinconts@gmail.com";
export const ADMIN_LEADS_LIMIT = 999999;

export const isAdminEmail = (email?: string | null): boolean => {
  const normalized = email?.trim().toLowerCase();
  return (
    normalized === ADMIN_EMAIL ||
    normalized === LEGACY_ADMIN_EMAIL ||
    normalized === NEW_ADMIN_EMAIL ||
    normalized === NEW_LEGACY_ADMIN_EMAIL
  );
};

type AdminUserLike = {
  email?: string | null;
} | null | undefined;

type AdminProfileLike = {
  role?: string | null;
  is_admin?: boolean | null;
} | null | undefined;

export const isAdminUser = (
  user?: AdminUserLike,
  profile?: AdminProfileLike,
): boolean => {
  return Boolean(
    profile?.role === "admin" ||
    profile?.is_admin === true ||
    isAdminEmail(user?.email),
  );
};
