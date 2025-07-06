import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

interface AuthData {
    authorized: boolean;
    message?: string;
    userId?: string;
    clubId?: string;
    role?: 'admin' | 'user';
}

export const verifyToken = (req: VercelRequest): AuthData => {
    if (!JWT_SECRET) {
      console.error("JWT_SECRET is not defined in environment variables.");
      return { authorized: false, message: 'Internal server configuration error.' };
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authorized: false, message: 'Authorization header missing or malformed.' };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return { authorized: false, message: 'Token not found.' };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return {
            authorized: true,
            userId: decoded.userId,
            clubId: decoded.clubId,
            role: decoded.role,
        };
    } catch (error) {
        return { authorized: false, message: 'Invalid or expired token.' };
    }
};
