---
name: authentication
description: Auth implementation patterns (JWT, OAuth, sessions)
keywords:
  - auth
  - login
  - signup
  - JWT
  - token
  - session
  - OAuth
  - password
  - bcrypt
  - middleware
  - protected route
alwaysApply: false
---

# Authentication Skill

## Auth Strategy Decision

| Method | Best For | Tradeoffs |
|--------|----------|-----------|
| JWT (stateless) | APIs, microservices, mobile | Can't revoke easily, size grows with claims |
| Sessions (server-side) | Traditional web apps | Requires session store, stateful |
| OAuth 2.0 | "Sign in with Google/GitHub" | Complex flow, external dependency |
| API Keys | Service-to-service, developer APIs | No user context, harder to rotate |

## JWT Implementation

```typescript
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET!;

// Create token
function createToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, SECRET, { expiresIn: '1h' });
}

// Verify middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  
  try {
    const payload = jwt.verify(header.slice(7), SECRET) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

## Password Hashing

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

## Security Checklist

- [ ] Passwords hashed with bcrypt/argon2 (cost factor >= 12)
- [ ] Tokens expire (short-lived access + longer refresh)
- [ ] Rate limiting on login endpoint (prevent brute force)
- [ ] Account lockout after N failed attempts
- [ ] HTTPS required for all auth endpoints
- [ ] Tokens stored in httpOnly cookies (not localStorage)
- [ ] CSRF protection for cookie-based auth
- [ ] Secrets in environment variables, never in code

## Refresh Token Flow

1. User logs in → server returns access token (15min) + refresh token (7d)
2. Access token expires → client sends refresh token to `/auth/refresh`
3. Server validates refresh token → issues new access token
4. Refresh token expires → user must log in again

## Role-Based Access Control (RBAC)

```typescript
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

app.delete('/users/:id', authMiddleware, requireRole('admin'), deleteUser);
```
