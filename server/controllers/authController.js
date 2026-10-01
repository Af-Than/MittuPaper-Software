import bcrypt from 'bcryptjs';
import { Admin, LoginLog } from '../models/index.js';
import { COOKIE_NAME, cookieOptions, signToken } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';

// Used so a wrong username takes about as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const clientIp = (req) => (req.ip || '').replace('::ffff:', '') || 'unknown';

export async function login(req, res) {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username: username.toLowerCase() });
  const ok = await bcrypt.compare(password, admin ? admin.passwordHash : DUMMY_HASH);

  await LoginLog.create({
    admin: admin?._id || null,
    username: username.toLowerCase(),
    adminName: admin?.name || '',
    success: !!(admin && ok),
    ip: clientIp(req),
    userAgent: (req.get('user-agent') || '').slice(0, 300),
  });

  if (!admin || !ok) throw new HttpError(401, 'Incorrect username or password', 'INVALID_CREDENTIALS');

  res.cookie(COOKIE_NAME, signToken(admin), { ...cookieOptions(), maxAge: env.cookieMaxAgeMs });
  res.json({ admin: { id: admin._id, name: admin.name, username: admin.username } });
}

export function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ admin: req.admin });
}
