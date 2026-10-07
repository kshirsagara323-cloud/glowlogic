import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

export interface AuthUser {
  id: string;
  email: string;
  /** Policy version the user accepted at sign-up (from their sign-up metadata). */
  policyVersion?: string;
}

export type TokenVerifier = (token: string) => Promise<AuthUser | null>;

const POLICY_VERSION_PATTERN = /^[a-z0-9-]{1,40}$/;

function toUser(id: unknown, email: unknown, metadata: unknown): AuthUser | null {
  if (typeof id !== 'string' || typeof email !== 'string' || !email) return null;
  const version = (metadata as { accepted_policy_version?: unknown } | null | undefined)?.accepted_policy_version;
  const user: AuthUser = { id, email: email.toLowerCase() };
  if (typeof version === 'string' && POLICY_VERSION_PATTERN.test(version)) user.policyVersion = version;
  return user;
}

function fromClaims(payload: JWTPayload): AuthUser | null {
  return toUser(payload.sub, payload['email'], payload['user_metadata']);
}

/**
 * Verifies a Supabase access token.
 * - Asymmetric tokens (ES256/RS256): verified locally against the project's public keys (JWKS).
 * - Older shared-secret tokens (HS256): confirmed by asking Supabase Auth directly, which is the
 *   documented alternative, so we never need the shared secret.
 */
export function createSupabaseVerifier(supabaseUrl: string, publishableKey: string): TokenVerifier {
  const authBase = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  const jwks = createRemoteJWKSet(new URL(`${authBase}/.well-known/jwks.json`));

  async function verifyWithAuthServer(token: string): Promise<AuthUser | null> {
    const response = await fetch(`${authBase}/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { id?: unknown; email?: unknown; user_metadata?: unknown };
    return toUser(body.id, body.email, body.user_metadata);
  }

  return async (token) => {
    try {
      const header = decodeProtectedHeader(token);
      if (typeof header.alg === 'string' && header.alg.startsWith('HS')) {
        return await verifyWithAuthServer(token);
      }
      const { payload } = await jwtVerify(token, jwks, { issuer: authBase, audience: 'authenticated' });
      return fromClaims(payload);
    } catch {
      return null; // malformed, expired, wrong signature, wrong issuer, or auth server unreachable
    }
  };
}
