/**
 * Webhook auth helpers for deploy-trigger endpoints.
 * Written for the Cloudflare Workers runtime (Web Crypto API only — no Node crypto).
 *
 * Sanity sends a signed `sanity-webhook-signature` header:
 * format: `t=<unix-timestamp>,v1=<base64url-sig>`
 */

const SANITY_SIGNATURE_MAX_AGE_S = 5 * 60;

interface SanitySignatureParts {
  timestamp: number;
  signature: string;
}

function parseSanitySignatureHeader(header: string | null): SanitySignatureParts | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const eq = p.indexOf('=');
      return eq === -1 ? [p.trim(), ''] : [p.slice(0, eq).trim(), p.slice(eq + 1).trim()];
    })
  );
  const tsRaw = parts['t'];
  const sig = parts['v1'];
  if (!tsRaw || !sig) return null;
  const timestamp = Number(tsRaw);
  if (!Number.isFinite(timestamp)) return null;
  return { timestamp, signature: sig };
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifySanitySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  const parsed = parseSanitySignatureHeader(signatureHeader);
  if (!parsed) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > SANITY_SIGNATURE_MAX_AGE_S) {
    return false;
  }

  const encoder = new TextEncoder();
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch {
    return false;
  }

  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${parsed.timestamp}.${rawBody}`)
  );
  const computed = base64UrlEncode(sigBuffer);
  return timingSafeEqualStrings(computed, parsed.signature);
}

export function verifyEventbriteSecret(url: URL, expectedSecret: string): boolean {
  const provided = url.searchParams.get('secret');
  if (!provided) return false;
  return timingSafeEqualStrings(provided, expectedSecret);
}
