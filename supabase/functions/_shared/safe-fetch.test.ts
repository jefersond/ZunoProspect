import { describe, expect, it, vi } from "vitest";
import { assertPublicUrl, isBlockedIp, safeFetchText } from "./safe-fetch.ts";

const PUBLIC_IP = "93.184.216.34";
const dnsPublic = vi.fn(async (_h: string, type: "A" | "AAAA") => (type === "A" ? [PUBLIC_IP] : []));

function html(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, ...init });
}

describe("isBlockedIp", () => {
  it.each([
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "100.100.100.200", "127.0.0.1", "127.8.9.10",
    "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "192.0.0.1",
    "198.18.0.1", "224.0.0.1", "240.0.0.1", "255.255.255.255",
    "::", "::1", "fe80::1", "fd00:ec2::254", "fc00::1", "ff02::1", "2001:db8::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1",
    "2002:7f00:1::", "not-an-ip", "1.2.3",
  ])("blocks %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "100.63.255.255", "2606:4700:4700::1111", "::ffff:5db8:d822"])(
    "allows public %s",
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );
});

describe("assertPublicUrl", () => {
  it.each([
    "ftp://example.com", "file:///etc/passwd", "gopher://example.com", "javascript:alert(1)",
    "http://127.0.0.1/", "http://localhost/", "http://foo.localhost/", "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/", "http://metadata.google.internal/",
    "http://2130706433/", "http://0x7f.1/", "http://0177.0.0.1/", "http://user:pw@example.com/",
    "http://example.com:8080/", "http://10.0.0.5/", "http://[fd00:ec2::254]/",
  ])("rejects %s", async (url) => {
    await expect(assertPublicUrl(url, dnsPublic)).rejects.toThrow();
  });

  it("rejects a hostname that resolves to a private IP", async () => {
    const dns = vi.fn(async (_h: string, type: "A" | "AAAA") => (type === "A" ? [PUBLIC_IP, "10.0.0.8"] : []));
    await expect(assertPublicUrl("https://evil.example/", dns)).rejects.toThrow("ip_bloqueado");
  });

  it("rejects a hostname whose AAAA resolves to loopback", async () => {
    const dns = vi.fn(async (_h: string, type: "A" | "AAAA") => (type === "A" ? [PUBLIC_IP] : ["::1"]));
    await expect(assertPublicUrl("https://evil.example/", dns)).rejects.toThrow("ip_bloqueado");
  });

  it("fails closed when DNS yields nothing", async () => {
    const dns = vi.fn(async () => []);
    await expect(assertPublicUrl("https://nx.example/", dns)).rejects.toThrow("dns_sem_resultado");
  });

  it("accepts a public https URL", async () => {
    const url = await assertPublicUrl("https://example.com/path", dnsPublic);
    expect(url.hostname).toBe("example.com");
  });
});

describe("safeFetchText", () => {
  it("returns the body of a public site", async () => {
    const fetchImpl = vi.fn(async () => html("<html>ok</html>"));
    const result = await safeFetchText("https://example.com", { fetchImpl, resolveDns: dnsPublic });
    expect(result).toEqual({ ok: true, text: "<html>ok</html>", finalUrl: "https://example.com/" });
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/", expect.objectContaining({ redirect: "manual" }));
  });

  it("never fetches a blocked first URL", async () => {
    const fetchImpl = vi.fn();
    const result = await safeFetchText("http://169.254.169.254/latest/meta-data/", { fetchImpl, resolveDns: dnsPublic });
    expect(result).toEqual({ ok: false, reason: "ip_bloqueado" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks a redirect to an internal address without fetching it", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } }));
    const result = await safeFetchText("https://example.com", { fetchImpl, resolveDns: dnsPublic });
    expect(result).toEqual({ ok: false, reason: "ip_bloqueado" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("blocks a redirect to a hostname resolving to a private IP", async () => {
    const dns = vi.fn(async (h: string, type: "A" | "AAAA") =>
      type === "A" ? [h === "internal.example" ? "192.168.0.10" : PUBLIC_IP] : []);
    const fetchImpl = vi.fn(async () =>
      new Response(null, { status: 301, headers: { location: "https://internal.example/admin" } }));
    const result = await safeFetchText("https://example.com", { fetchImpl, resolveDns: dns });
    expect(result).toEqual({ ok: false, reason: "ip_bloqueado" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("follows a safe relative redirect", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/home" } }))
      .mockResolvedValueOnce(html("final"));
    const result = await safeFetchText("https://example.com", { fetchImpl, resolveDns: dnsPublic });
    expect(result).toEqual({ ok: true, text: "final", finalUrl: "https://example.com/home" });
  });

  it("stops after too many redirects", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://example.com/loop" } }));
    const result = await safeFetchText("https://example.com", { fetchImpl, resolveDns: dnsPublic, maxRedirects: 3 });
    expect(result).toEqual({ ok: false, reason: "redirects_excedidos" });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("caps the response size", async () => {
    const fetchImpl = vi.fn(async () => html("a".repeat(5000)));
    const result = await safeFetchText("https://example.com", { fetchImpl, resolveDns: dnsPublic, maxBytes: 100 });
    expect(result.ok && result.text.length).toBe(100);
  });

  it("reports timeout when the request never completes", async () => {
    const fetchImpl = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted")))),
    );
    const result = await safeFetchText("https://example.com", { fetchImpl, resolveDns: dnsPublic, timeoutMs: 20 });
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("returns a reason for HTTP errors and fetch failures instead of throwing", async () => {
    const notFound = vi.fn(async () => new Response("x", { status: 404 }));
    expect(await safeFetchText("https://example.com", { fetchImpl: notFound, resolveDns: dnsPublic })).toEqual({
      ok: false,
      reason: "http_404",
    });
    const boom = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await safeFetchText("https://example.com", { fetchImpl: boom, resolveDns: dnsPublic })).toEqual({
      ok: false,
      reason: "network down",
    });
  });
});
