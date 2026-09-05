import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getUserProfileAndPreferences,
  updateUserProfile,
  updateUserPreferences
} from '../db/userProfileRepository.js';

const userRouter = Router();

// GET /api/user/profile - Get profile and preferences for authenticated user
userRouter.get('/user/profile', requireAuth, async (req, res) => {
  try {
    const data = await getUserProfileAndPreferences(req.user.id);
    res.json({
      success: true,
      user: data.user,
      profile: data.profile,
      preferences: data.preferences
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      success: false,
      error: {
        code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message: err.message || 'Failed to retrieve user profile.'
      }
    });
  }
});

// PUT /api/user/profile - Update profile details
userRouter.put('/user/profile', requireAuth, async (req, res) => {
  try {
    const { displayName, avatarUrl, headline } = req.body || {};
    const updatedProfile = await updateUserProfile(req.user.id, { displayName, avatarUrl, headline });
    res.json({
      success: true,
      profile: updatedProfile
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      success: false,
      error: {
        code: 'PROFILE_UPDATE_ERROR',
        message: err.message || 'Failed to update profile.'
      }
    });
  }
});

// PUT /api/user/preferences - Update application preferences
userRouter.put('/user/preferences', requireAuth, async (req, res) => {
  try {
    const { defaultProvider, theme, telemetryEnabled, autoScrollConsole, maxDiagnosticLength } = req.body || {};
    const updatedPreferences = await updateUserPreferences(req.user.id, {
      defaultProvider,
      theme,
      telemetryEnabled,
      autoScrollConsole,
      maxDiagnosticLength
    });
    res.json({
      success: true,
      preferences: updatedPreferences
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      success: false,
      error: {
        code: 'PREFERENCES_UPDATE_ERROR',
        message: err.message || 'Failed to update preferences.'
      }
    });
  }
});

export default userRouter;
