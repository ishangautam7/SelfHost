import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface Claims {
  sub: string;
  username: string;
  exp: number;
}

// Extend Express Request to include user claims
declare global {
  namespace Express {
    interface Request {
      user?: Claims;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7);
  const secret = process.env.JWT_SECRET || 'supersecretjwtkeythatshouldbechangedinprod';

  try {
    const decoded = jwt.verify(token, secret) as Claims;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
