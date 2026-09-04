import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth.js';

/**
 * Extracts and verifies the authenticated session and user from request headers/cookies.
 * Converts Express node headers to Web standard Headers via fromNodeHeaders.
 * @param {import('express').Request} req
 * @returns {Promise<{ user: any, session: any } | null>}
 */
export async function extractSessionUser(req) {
  try {
    const webHeaders = fromNodeHeaders(req.headers);
    const session = await auth.api.getSession({
      headers: webHeaders
    });
    if (session && session.user) {
      return session;
    }
    return null;
  } catch (err) {
    console.warn('[AuthMiddleware] Error verifying session:', err.message);
    return null;
  }
}

/**
 * Express middleware requiring a valid authenticated session.
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export async function requireAuth(req, res, next) {
  try {
    const sessionData = await extractSessionUser(req);
    if (!sessionData || !sessionData.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required. Please sign in to access this resource.',
          code: 'UNAUTHORIZED'
        }
      });
    }

    req.user = sessionData.user;
    req.session = sessionData.session;
    next();
  } catch (err) {
    console.error('[AuthMiddleware] Unexpected authentication error:', err);
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired authentication session.',
        code: 'UNAUTHORIZED'
      }
    });
  }
}

/**
 * Optional authentication middleware for endpoints that can behave differently for authenticated vs anonymous users.
 */
export async function optionalAuth(req, res, next) {
  try {
    const sessionData = await extractSessionUser(req);
    if (sessionData && sessionData.user) {
      req.user = sessionData.user;
      req.session = sessionData.session;
    }
  } catch (err) {
    // Ignore error for optional auth
  }
  next();
}
