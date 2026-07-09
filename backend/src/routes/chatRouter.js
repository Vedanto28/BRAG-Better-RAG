import { Router } from 'express';
import { runAgentOrchestrator } from '../services/agentOrchestrator.js';

const chatRouter = Router();

chatRouter.post('/chat', async (req, res) => {
  try {
    const { message } = req.body ?? {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required.',
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
      message: clientMessage,
    });
  }
});

export default chatRouter;
