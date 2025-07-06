import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure-default-dev-secret-please-replace-in-production';

interface AuthData {
    authorized: boolean;
    message?: string;
    userId?: string;
    username?: string;
    role?: 'superadmin' | 'admin' | 'user';
    clubName?: string;
}

export const verifyToken = (req: VercelRequest): AuthData => {
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
            username: decoded.username,
            role: decoded.role,
            clubName: decoded.clubName,
        };
    } catch (error) {
        return { authorized: false, message: 'Invalid or expired token.' };
    }
};
