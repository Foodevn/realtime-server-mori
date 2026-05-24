import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import type { Socket } from 'socket.io';

type NextFn = (err?: Error) => void;

// Lazy-init JWKS client (created once on first use)
let client: jwksClient.JwksClient | null = null;

function getClient(): jwksClient.JwksClient {
  if (!client) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Server misconfiguration: missing SUPABASE_URL');
    }
    client = jwksClient({
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600_000, // 10 minutes
    });
  }
  return client;
}

export async function authMiddleware(socket: Socket, next: NextFn): Promise<void> {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    return next(new Error('Unauthorized: no token provided'));
  }

  try {
    // Decode header to get kid + algorithm
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      return next(new Error('Unauthorized: malformed token'));
    }

    const { alg, kid } = decoded.header;

    // ES256 (new Supabase JWT Signing Keys) → verify with JWKS public key
    if (alg === 'ES256') {
      if (!kid) {
        return next(new Error('Unauthorized: token missing kid'));
      }

      const jwks = getClient();
      const key = await jwks.getSigningKey(kid);
      const publicKey = key.getPublicKey();

      const payload = jwt.verify(token, publicKey, {
        algorithms: ['ES256'],
      }) as jwt.JwtPayload;

      socket.data.userId = payload.sub;
      console.log('[Auth] ✅ User authenticated (ES256):', payload.sub);
      return next();
    }

    // HS256 (legacy JWT secret) → verify with symmetric secret
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      return next(new Error('Server misconfiguration: missing JWT secret'));
    }

    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;

    socket.data.userId = payload.sub;
    console.log('[Auth] ✅ User authenticated (HS256):', payload.sub);
    next();
  } catch (err) {
    console.error('[Auth] ❌ JWT verification failed:', (err as Error).message);
    next(new Error('Unauthorized: invalid token'));
  }
}
