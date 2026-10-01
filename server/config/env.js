import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// A single .env at the repository root is shared by server and tooling.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const e = process.env;

export const env = {
  port: Number(e.PORT) || 5050,
  isProd: e.NODE_ENV === 'production',
  mongoUri: e.MONGODB_URI || 'mongodb://127.0.0.1:27017/paper_delivery_manager',
  jwtSecret: e.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: '8h',
  cookieMaxAgeMs: 8 * 60 * 60 * 1000,
  clientOrigin: e.CLIENT_ORIGIN || 'http://localhost:5173',
  // Exactly two admins, created by the seed script only.
  admins: [
    {
      username: (e.ADMIN1_USERNAME || 'admin1').toLowerCase(),
      name: e.ADMIN1_NAME || 'Agency Owner',
      password: e.ADMIN1_PASSWORD || 'Admin@123',
    },
    {
      username: (e.ADMIN2_USERNAME || 'admin2').toLowerCase(),
      name: e.ADMIN2_NAME || 'Agency Manager',
      password: e.ADMIN2_PASSWORD || 'Admin@456',
    },
  ],
};
