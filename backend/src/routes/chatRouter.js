import { Router } from 'express';
import { runAgentOrchestrator } from '../services/agentOrchestrator.js';
import { recordChatInteraction } from '../db/investigationRepository.js';

const chatRouter = Router();

const SUPPORTED_BYOK_PROVIDERS = ['gemini', 'openai', 'openrouter', 'groq', 'cerebras', 'deepseek'];

/**
 * Extracts and validates user-supplied BYOK credentials from headers or request body.
 * Validates key format (non-empty, min 10 chars, no whitespace/control chars).
 * Throws a 400 validation error on malformed keys without echoing key content.
 */
function extractAndValidateUserCredentials(req) {
  const credentials = {};

  // 1. Extract from body userCredentials object if present
  if (req.body?.userCredentials && typeof req.body.userCredentials === 'object') {
    for (const [provider, keyVal] of Object.entries(req.body.userCredentials)) {
      const lowerProv = provider.toLowerCase();
      if (SUPPORTED_BYOK_PROVIDERS.includes(lowerProv) && keyVal) {
        credentials[lowerProv] = String(keyVal).trim();
      }
    }
  }

  // 2. Extract from individual x-byok-[provider]-key headers
  for (const provider of SUPPORTED_BYOK_PROVIDERS) {
    const headerName = `x-byok-${provider}-key`;
    const headerVal = req.headers[headerName];
    if (headerVal && typeof headerVal === 'string' && headerVal.trim().length > 0) {
      credentials[provider] = headerVal.trim();
    }
  }

  // 3. Extract from x-byok-keys JSON header if present
  const keysHeader = req.headers['x-byok-keys'];
  if (keysHeader && typeof keysHeader === 'string') {
    try {
      const parsed = JSON.parse(keysHeader);
      if (parsed && typeof parsed === 'object') {
        for (const [provider, keyVal] of Object.entries(parsed)) {
          const lowerProv = provider.toLowerCase();
          if (SUPPORTED_BYOK_PROVIDERS.includes(lowerProv) && keyVal) {
            credentials[lowerProv] = String(keyVal).trim();
          }
        }
      }
    } catch (e) {
      const err = new Error('Invalid JSON format in x-byok-keys header.');
      err.status = 400;
      throw err;
    }
  }

  // 4. Validate key format for each extracted key
  for (const [provider, keyVal] of Object.entries(credentials)) {
    if (!keyVal || typeof keyVal !== 'string') continue;
    
    // Check min length and whitespace/control char safety
    if (keyVal.length < 10 || /\s/.test(keyVal) || /[\x00-\x1F\x7F]/.test(keyVal)) {
      const err = new Error(`Invalid key format for provider '${provider}'. Keys must be non-empty, at least 10 characters long, and contain no whitespace.`);
      err.status = 400;
      throw err;
    }
  }

  return credentials;
}

chatRouter.post('/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, investigationId } = req.body ?? {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Message is required.',
          code: 'VALIDATION_ERROR'
        },
        metadata: {
          provider: "unknown",
          contextFound: false,
          toolUsed: null,
          mode: "unknown",
          toolsUsed: [],
          inspectedPaths: [],
          debuggingMatches: [],
          commitsInspected: [],
          logEvidence: { errorType: "", groupedOccurrences: 0, framesReferenced: [] },
          externalEvidence: [],
          toolCallsUsed: 0,
          toolCallLimitReached: false,
          capabilityPlan: {},
          executionGuidance: { suggestedPriority: [], suggestedBudgetGuidance: "" },
          observabilityTrace: {}
        }
      });
    }

    const userCredentials = extractAndValidateUserCredentials(req);

    const result = await runAgentOrchestrator(message, { userCredentials });
    const latencyMs = Date.now() - startTime;

    // Persist investigation, messages, evidence, and telemetry
    try {
      await recordChatInteraction({
        investigationId,
        userMessage: message,
        assistantResult: result,
        latencyMs
      });
    } catch (dbErr) {
      console.warn('[ChatRouter] Non-fatal DB persistence failure:', dbErr.message);
    }

    res.json(result);
  } catch (error) {
    console.error('Chat route error:', error.message || error);
    const status = error.status || 500;
    const clientMessage = status === 400
      ? error.message
      : 'Mechamaru could not process that message.';
    res.status(status).json({
      success: false,
      error: {
        message: clientMessage,
        code: status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR'
      },
      metadata: {
        provider: "unknown",
        contextFound: false,
        toolUsed: null,
        mode: "unknown",
        toolsUsed: [],
        inspectedPaths: [],
        debuggingMatches: [],
        commitsInspected: [],
        logEvidence: { errorType: "", groupedOccurrences: 0, framesReferenced: [] },
        externalEvidence: [],
        toolCallsUsed: 0,
        toolCallLimitReached: false,
        capabilityPlan: {},
        executionGuidance: { suggestedPriority: [], suggestedBudgetGuidance: "" },
        observabilityTrace: {}
      }
    });
  }
});

export default chatRouter;
