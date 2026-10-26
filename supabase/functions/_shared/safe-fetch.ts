// Fetch seguro para URLs controladas por terceiros (ex.: site informado no Google Places).
// Protege contra SSRF: so HTTP/HTTPS publico, DNS e cada redirecionamento validados,
// com limites de tempo, redirecionamentos e tamanho da resposta.

export type SafeFetchResult =
  | { ok: true; text: string; finalUrl: string }
  | { ok: false; reason: string };

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  resolveDns?: (hostname: string, type: "A" | "AAAA") => Promise<string[]>;
}

const DEFAULT_TIMEOUT_MS = 4500;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 1_000_000;

const BLOCKED_HOSTNAMES = ["localhost", "metadata.google.internal", "metadata"];
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet"];

// [rede, prefixo]
const BLOCKED_V4: Array<[number, number]> = [
  [0x00000000, 8], // "this network"
  [0x0a000000, 8], // 10/8
  [0x64400000, 10], // 100.64/10 (CGNAT, inclui metadados Alibaba)
  [0x7f000000, 8], // loopback
  [0xa9fe0000, 16], // link-local (inclui 169.254.169.254)
  [0xac100000, 12], // 172.16/12
  [0xc0000000, 24], // 192.0.0/24
  [0xc0000200, 24], // TEST-NET-1
  [0xc0586300, 24], // 6to4 relay anycast
  [0xc0a80000, 16], // 192.168/16
  [0xc6120000, 15], // 198.18/15
  [0xc6336400, 24], // TEST-NET-2
  [0xcb007100, 24], // TEST-NET-3
  [0xe0000000, 4], // multicast
  [0xf0000000, 4], // reservado + broadcast
];

function parseIPv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function isBlockedIPv4Number(n: number): boolean {
  return BLOCKED_V4.some(([net, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === net;
  });
}

// Expande IPv6 para 8 grupos de 16 bits; null se invalido.
function parseIPv6(input: string): number[] | null {
  let ip = input.toLowerCase();
  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);

  // sufixo IPv4 embutido (::ffff:1.2.3.4)
  const lastColon = ip.lastIndexOf(":");
  if (ip.includes(".")) {
    const v4 = parseIPv4(ip.slice(lastColon + 1));
    if (v4 === null) return null;
    ip = `${ip.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

function isBlockedIPv6(g: number[]): boolean {
  const allZeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  const embeddedV4 = ((g[6] << 16) | g[7]) >>> 0;

  if (allZeroUpTo(7) && (g[7] === 0 || g[7] === 1)) return true; // :: e ::1
  if (allZeroUpTo(5) && g[5] === 0xffff) return isBlockedIPv4Number(embeddedV4); // ::ffff:a.b.c.d
  if (allZeroUpTo(6)) return true; // ::a.b.c.d (IPv4-compatible, obsoleto)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIPv4Number(embeddedV4); // NAT64 64:ff9b::/96
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true; // 64:ff9b:1::/48 (local-use NAT64)
  if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // discard 100::/64
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo 2001::/32
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true; // documentacao
  if (g[0] === 0x2002) return isBlockedIPv4Number(((g[1] << 16) | g[2]) >>> 0); // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true; // ULA fc00::/7 (inclui fd00:ec2::254)
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // site-local obsoleto
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  return false;
}

/** true se o IP (v4 ou v6) NAO e um destino publico permitido. Entrada invalida e bloqueada. */
export function isBlockedIp(ip: string): boolean {
  const trimmed = ip.replace(/^\[|\]$/g, "");
  const v4 = parseIPv4(trimmed);
  if (v4 !== null) return isBlockedIPv4Number(v4);
  if (trimmed.includes(":")) {
    const v6 = parseIPv6(trimmed);
    return v6 === null ? true : isBlockedIPv6(v6);
  }
  return true;
}

function isIpLiteral(host: string): boolean {
  return parseIPv4(host) !== null || host.includes(":");
}

async function defaultResolveDns(hostname: string, type: "A" | "AAAA"): Promise<string[]> {
  const d = (globalThis as { Deno?: { resolveDns?: (h: string, t: string) => Promise<string[]> } }).Deno;
  if (!d || typeof d.resolveDns !== "function") throw new Error("dns_unavailable");
  return await d.resolveDns(hostname, type);
}

/** Valida esquema, credenciais, porta, hostname e todos os IPs resolvidos. Lanca Error(reason) se bloqueado. */
export async function assertPublicUrl(
  rawUrl: string,
  resolveDns: NonNullable<SafeFetchOptions["resolveDns"]> = defaultResolveDns,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("url_invalida");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("esquema_nao_permitido");
  if (url.username || url.password) throw new Error("credenciais_na_url");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("porta_nao_permitida");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new Error("host_vazio");
  if (BLOCKED_HOSTNAMES.includes(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new Error("host_bloqueado");
  }

  if (isIpLiteral(host)) {
    if (isBlockedIp(host)) throw new Error("ip_bloqueado");
    return url;
  }

  const [a, aaaa] = await Promise.allSettled([resolveDns(host, "A"), resolveDns(host, "AAAA")]);
  const ips: string[] = [];
  for (const r of [a, aaaa]) if (r.status === "fulfilled") ips.push(...r.value);
  if (ips.length === 0) {
    const unavailable = [a, aaaa].some((r) => r.status === "rejected" && String(r.reason).includes("dns_unavailable"));
    throw new Error(unavailable ? "dns_unavailable" : "dns_sem_resultado");
  }
  if (ips.some(isBlockedIp)) throw new Error("ip_bloqueado");
  return url;
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const room = maxBytes - total;
    chunks.push(value.length > room ? value.subarray(0, room) : value);
    total += Math.min(value.length, room);
  }
  await reader.cancel().catch(() => {});
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(merged);
}

/** GET com validacao de cada salto, limites de tempo/redirecionamentos/tamanho. Nunca lanca. */
export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    maxBytes = DEFAULT_MAX_BYTES,
    headers,
    fetchImpl = fetch,
    resolveDns = defaultResolveDns,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const url = await assertPublicUrl(current, resolveDns);
      const response = await fetchImpl(url.toString(), {
        headers,
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => {});
        if (!location) return { ok: false, reason: "redirect_sem_location" };
        current = new URL(location, url).toString();
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        return { ok: false, reason: `http_${response.status}` };
      }
      const text = await readCapped(response, maxBytes);
      return { ok: true, text, finalUrl: url.toString() };
    }
    return { ok: false, reason: "redirects_excedidos" };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, reason: "timeout" };
    return { ok: false, reason: error instanceof Error ? error.message : "erro_desconhecido" };
  } finally {
    clearTimeout(timer);
  }
}
