import { Request, Response } from 'express';
import { authService } from '../services/auth/AuthService';
import { ApiResponse } from '../types';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Username, email, and password are required' },
      } as ApiResponse);
      return;
    }

    const user = await authService.register({ username, email, password });

    // Don't send password hash in response
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      level: user.level,
      xp: user.xp,
      hasToolsAccess: user.hasToolsAccess,
    };

    res.status(201).json({
      success: true,
      data: { user: userResponse },
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Email and password are required' },
      } as ApiResponse);
      return;
    }

    const { user, token } = await authService.login({ email, password });

    // Don't send password hash in response
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      level: user.level,
      xp: user.xp,
      hasToolsAccess: user.hasToolsAccess,
    };

    res.json({
      success: true,
      data: {
        user: userResponse,
        token,
      },
    } as ApiResponse);
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: { message: error.message },
    } as ApiResponse);
  }
};

