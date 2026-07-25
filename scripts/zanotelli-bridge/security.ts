// Assinatura HMAC-SHA256 do lado emissor (Zuno Prospect -> Zanotelli OS).
// Web Crypto padrão — funciona em Node, Deno e no navegador, mas este
// módulo nunca deve rodar no navegador: o segredo é somente de backend.

export async function signHmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Mascara um identificador para exibição segura em logs/relatórios. */
export function maskIdentifier(value: string): string {
  if (value.length <= 8) return '*'.repeat(value.length)
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}
