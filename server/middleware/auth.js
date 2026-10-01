import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';

export const COOKIE_NAME = 'pt_token';

export function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: env.isProd, path: '/' };
}

export function signToken(admin) {
  return jwt.sign({ id: String(admin._id), name: admin.name, username: admin.username }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/** Requires a valid JWT cookie; exposes the admin as req.admin. */
export function requireAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next(new HttpError(401, 'Please sign in to continue', 'UNAUTHENTICATED'));
  try {
    const p = jwt.verify(token, env.jwtSecret);
    req.admin = { id: p.id, name: p.name, username: p.username };
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Please sign in again.', 'SESSION_EXPIRED'));
  }
}
