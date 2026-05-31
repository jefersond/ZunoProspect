export const APP_ROUTES = {
  auth: "/auth",
  dashboard: "/dashboard",
  prospection: "/prospeccao",
  upgrade: "/precos",
  profile: "/profile",
};

/**
 * Constrói uma URL completa do app com base no caminho relativo e parâmetros dinâmicos (como UTMs).
 */
export function buildAppUrl(path: string, params?: Record<string, string>) {
  const baseUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://zunopropect.com.br";
  // Remove barra inicial duplicada se houver
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(cleanPath, baseUrl);
  
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  
  return url.toString();
}
