import { betterAuth } from 'better-auth';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../db/connection.js';

const currentFilePath = fileURLToPath(import.meta.url);
const authDir = path.dirname(currentFilePath);
const backendEnvPath = path.resolve(authDir, '..', '..', '.env');
const rootEnvPath = path.resolve(authDir, '..', '..', '..', '.env');

dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

const pool = await getPool();

const isProduction = process.env.NODE_ENV === 'production';
const baseURL = process.env.BETTER_AUTH_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:5000');

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET || 'brag-secret-key-at-least-32-characters-for-dev',
  baseURL,
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scope: ['openid', 'email', 'profile']
      }
    } : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scope: ['read:user', 'user:email']
      }
    } : {})
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6
  },
  trustedOrigins: [
    'https://brag-better-rag.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5000',
    'http://localhost:3000'
  ],
  advanced: {
    defaultCookieAttributes: {
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction || baseURL.startsWith('https'),
      httpOnly: true,
      path: '/'
    }
  }
});

export default auth;
