import { query } from './connection.js';

/**
 * Ensures a BRAG user profile and preferences record exists for the given Better Auth user ID.
 * Idempotent: creates only if missing, does not overwrite existing data.
 * @param {string} userId Canonical Better Auth user ID
 * @param {object} [defaultData] Optional user display data (name, email, image)
 * @returns {Promise<{ profile: object, preferences: object }>}
 */
export async function ensureUserProfileAndPreferences(userId, defaultData = {}) {
  if (!userId) {
    throw new Error('User ID is required to ensure profile and preferences.');
  }

  // 1. Ensure User Profile
  const profileRes = await query(
    `SELECT * FROM user_profile WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  let profile = profileRes.rows[0];
  if (!profile) {
    const displayName = defaultData.name || (defaultData.email ? defaultData.email.split('@')[0] : 'Engineer');
    const avatarUrl = defaultData.image || null;

    const insertRes = await query(
      `INSERT INTO user_profile (user_id, display_name, avatar_url, headline, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId, displayName, avatarUrl, 'Engineering Team Member']
    );
    profile = insertRes.rows[0];
  }

  // 2. Ensure User Preferences
  const prefRes = await query(
    `SELECT * FROM user_preferences WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  let preferences = prefRes.rows[0];
  if (!preferences) {
    const insertPref = await query(
      `INSERT INTO user_preferences (user_id, default_provider, theme, telemetry_enabled, auto_scroll_console, max_diagnostic_length, updated_at)
       VALUES ($1, 'gemini', 'dark', TRUE, TRUE, 'balanced', NOW())
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId]
    );
    preferences = insertPref.rows[0];
  }

  return { profile, preferences };
}

/**
 * Retrieves the complete profile, preferences, and canonical user info for a user.
 * @param {string} userId
 * @returns {Promise<{ profile: object, preferences: object }>}
 */
export async function getUserProfileAndPreferences(userId) {
  const userRes = await query(
    `SELECT id, name, email, image, "createdAt" FROM "user" WHERE id = $1 LIMIT 1`,
    [userId]
  );

  if (userRes.rows.length === 0) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  const user = userRes.rows[0];
  const { profile, preferences } = await ensureUserProfileAndPreferences(userId, user);

  return {
    user,
    profile,
    preferences
  };
}

/**
 * Updates editable profile fields for a user.
 * @param {string} userId
 * @param {{ displayName?: string, avatarUrl?: string, headline?: string }} updates
 * @returns {Promise<object>} Updated profile record
 */
export async function updateUserProfile(userId, updates = {}) {
  await ensureUserProfileAndPreferences(userId);

  const fields = [];
  const values = [userId];
  let paramIndex = 2;

  if (typeof updates.displayName === 'string') {
    fields.push(`display_name = $${paramIndex++}`);
    values.push(updates.displayName.trim());
  }

  if (typeof updates.avatarUrl === 'string' || updates.avatarUrl === null) {
    fields.push(`avatar_url = $${paramIndex++}`);
    values.push(updates.avatarUrl);
  }

  if (typeof updates.headline === 'string') {
    fields.push(`headline = $${paramIndex++}`);
    values.push(updates.headline.trim());
  }

  if (fields.length === 0) {
    const current = await query(`SELECT * FROM user_profile WHERE user_id = $1`, [userId]);
    return current.rows[0];
  }

  fields.push(`updated_at = NOW()`);

  const updateSql = `
    UPDATE user_profile
    SET ${fields.join(', ')}
    WHERE user_id = $1
    RETURNING *
  `;

  const res = await query(updateSql, values);
  return res.rows[0];
}

/**
 * Updates application preferences for a user.
 * @param {string} userId
 * @param {object} updates
 * @returns {Promise<object>} Updated preferences record
 */
export async function updateUserPreferences(userId, updates = {}) {
  await ensureUserProfileAndPreferences(userId);

  const fields = [];
  const values = [userId];
  let paramIndex = 2;

  const validProviders = ['gemini', 'openai', 'groq', 'openrouter', 'cerebras', 'deepseek'];
  if (updates.defaultProvider && validProviders.includes(updates.defaultProvider.toLowerCase())) {
    fields.push(`default_provider = $${paramIndex++}`);
    values.push(updates.defaultProvider.toLowerCase());
  }

  if (typeof updates.theme === 'string' && ['dark', 'light', 'system'].includes(updates.theme)) {
    fields.push(`theme = $${paramIndex++}`);
    values.push(updates.theme);
  }

  if (typeof updates.telemetryEnabled === 'boolean') {
    fields.push(`telemetry_enabled = $${paramIndex++}`);
    values.push(updates.telemetryEnabled);
  }

  if (typeof updates.autoScrollConsole === 'boolean') {
    fields.push(`auto_scroll_console = $${paramIndex++}`);
    values.push(updates.autoScrollConsole);
  }

  if (typeof updates.maxDiagnosticLength === 'string' && ['concise', 'balanced', 'deep_dive'].includes(updates.maxDiagnosticLength)) {
    fields.push(`max_diagnostic_length = $${paramIndex++}`);
    values.push(updates.maxDiagnosticLength);
  }

  if (fields.length === 0) {
    const current = await query(`SELECT * FROM user_preferences WHERE user_id = $1`, [userId]);
    return current.rows[0];
  }

  fields.push(`updated_at = NOW()`);

  const updateSql = `
    UPDATE user_preferences
    SET ${fields.join(', ')}
    WHERE user_id = $1
    RETURNING *
  `;

  const res = await query(updateSql, values);
  return res.rows[0];
}
