import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

export interface AuthRequest extends Request {
   user?: IUser;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
   try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (!token) {
         return res.status(401).json({ message: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
      const user = await User.findById(decoded.id).select('-passwordHash');
      if (!user) {
         return res.status(401).json({ message: 'User not found' });
      }
      req.user = user;
      next();
   } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
   }
};

export const optionalAuthenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
   try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
         const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
         const user = await User.findById(decoded.id).select('-passwordHash');
         if (user) {
            req.user = user;
         }
      }
      next();
   } catch (error) {
      next();
   }
};

// Optional: role-based middleware
export const authorize = (...roles: string[]) => {
   return (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      if (!roles.includes(req.user.role)) {
         return res.status(403).json({ message: 'Insufficient permissions' });
      }
      next();
   };
};