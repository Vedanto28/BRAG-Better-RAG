import { query } from '../db/connection.js';

/**
 * Published rate limits for supported LLM providers.
 * Encoded as declarative configuration rather than scattered magic numbers.
 */
export const PROVIDER_RATE_LIMITS = {
  groq: {
    name: 'Groq',
    rpm: 30,            // 30 requests / minute
    rpd: 14400,         // 14,400 requests / day
    tpm: 6000,          // 6,000 tokens / minute
    tpd: 500000,        // 500,000 tokens / day
    nearLimitPercent: 0.85
  },
  gemini: {
    name: 'Google Gemini',
    rpm: 15,            // 15 requests / minute
    rpd: 1500,          // 1,500 requests / day
    tpm: 1000000,       // 1,000,000 tokens / minute
    tpd: 10000000,      // 10,000,000 tokens / day
    nearLimitPercent: 0.85
  },
  openai: {
    name: 'OpenAI',
    rpm: 3,             // Tier 1 / Free default
    rpd: 200,
    tpm: 40000,
    tpd: 200000,
    nearLimitPercent: 0.85
  },
  openrouter: {
    name: 'OpenRouter',
    rpm: 20,
    rpd: 1000,
    tpm: 100000,
    tpd: 1000000,
    nearLimitPercent: 0.85
  },
  cerebras: {
    name: 'Cerebras',
    rpm: 30,
    rpd: 14400,
    tpm: 60000,
    tpd: 1000000,
    nearLimitPercent: 0.85
  },
  deepseek: {
    name: 'DeepSeek',
    rpm: 60,
    rpd: 10000,
    tpm: 100000,
    tpd: 2000000,
    nearLimitPercent: 0.85
  }
};

/**
 * Slices usage telemetry from the usage_metadata table for a specific provider.
 * @param {string} providerName Provider identifier (e.g. 'groq', 'gemini')
 * @returns {Promise<{ rpm: number, rpd: number, tpm: number, tpd: number }>}
 */
export async function getRecentProviderUsage(providerName) {
  try {
    const prov = providerName.toLowerCase();

    // 1. Minute usage (last 60 seconds)
    const minuteRes = await query(
      `SELECT 
         COUNT(*)::int as rpm,
         COALESCE(SUM(input_tokens + output_tokens), 0)::int as tpm
       FROM usage_metadata
       WHERE LOWER(provider) = $1
         AND created_at >= NOW() - INTERVAL '1 minute'`,
      [prov]
    );

    // 2. Day usage (current UTC day)
    const dayRes = await query(
      `SELECT 
         COUNT(*)::int as rpd,
         COALESCE(SUM(input_tokens + output_tokens), 0)::int as tpd
       FROM usage_metadata
       WHERE LOWER(provider) = $1
         AND created_at >= date_trunc('day', NOW())`,
      [prov]
    );

    const rpm = minuteRes.rows[0]?.rpm || 0;
    const tpm = minuteRes.rows[0]?.tpm || 0;
    const rpd = dayRes.rows[0]?.rpd || 0;
    const tpd = dayRes.rows[0]?.tpd || 0;

    return { rpm, rpd, tpm, tpd };
  } catch (err) {
    // If DB is offline or unreachable, return zero usage without throwing
    return { rpm: 0, rpd: 0, tpm: 0, tpd: 0 };
  }
}

/**
 * Determines whether a provider is near or exceeding its published rate limits.
 * @param {string} providerName
 * @param {object} [customUsage] Optional manual usage override (for testing)
 * @returns {Promise<{ isNearLimit: boolean, reason?: string, usage: object, limits: object }>}
 */
export async function isProviderNearLimit(providerName, customUsage = null) {
  const prov = providerName.toLowerCase();
  const limits = PROVIDER_RATE_LIMITS[prov];

  if (!limits) {
    return { isNearLimit: false, usage: {}, limits: {} };
  }

  const usage = customUsage || await getRecentProviderUsage(prov);
  const threshold = limits.nearLimitPercent || 0.85;

  if (usage.rpm >= limits.rpm * threshold) {
    return {
      isNearLimit: true,
      reason: `RPM limit near threshold (${usage.rpm}/${limits.rpm} req/min, >= ${Math.round(threshold * 100)}%)`,
      usage,
      limits
    };
  }

  if (usage.rpd >= limits.rpd * threshold) {
    return {
      isNearLimit: true,
      reason: `RPD limit near threshold (${usage.rpd}/${limits.rpd} req/day, >= ${Math.round(threshold * 100)}%)`,
      usage,
      limits
    };
  }

  if (usage.tpm >= limits.tpm * threshold) {
    return {
      isNearLimit: true,
      reason: `TPM limit near threshold (${usage.tpm}/${limits.tpm} tokens/min, >= ${Math.round(threshold * 100)}%)`,
      usage,
      limits
    };
  }

  if (usage.tpd >= limits.tpd * threshold) {
    return {
      isNearLimit: true,
      reason: `TPD limit near threshold (${usage.tpd}/${limits.tpd} tokens/day, >= ${Math.round(threshold * 100)}%)`,
      usage,
      limits
    };
  }

  return {
    isNearLimit: false,
    usage,
    limits
  };
}
