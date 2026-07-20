import { Router } from 'express';
import { runAgentOrchestrator } from '../services/agentOrchestrator.js';

const chatRouter = Router();

chatRouter.post('/chat', async (req, res) => {
  try {
    const { message } = req.body ?? {};

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

    const result = await runAgentOrchestrator(message);
    res.json(result);
  } catch (error) {
    console.error('Chat route error:', error);
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
