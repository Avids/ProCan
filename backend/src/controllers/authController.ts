import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { AuthRequest } from '../middleware/auth';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const data = await authService.loginEmployee(email, password);
    res.json(data);
  } catch (error: any) {
    if (error.message.includes('Invalid') || error.message.includes('inactive')) {
      res.status(401).json({ message: error.message });
    } else {
      next(error);
    }
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const userData = await authService.getEmployeeData(userId);
    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(userData);
  } catch (error) {
    next(error);
  }
};
