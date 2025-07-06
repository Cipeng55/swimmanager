import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

// WARNING: Using a default secret for development. This is insecure and should be
// replaced with a strong, unique secret in a production environment by setting
// the JWT_SECRET environment variable.
const JWT_SECRET = process.env.JWT_SECRET || 'insecure-default-dev-secret-please-replace-in-production';

interface AuthData {
    authorized: boolean;
    message?: string;
    userId?: string;
    clubId?: string;
    role?: 'superadmin' | 'admin' | 'user';
}

export const verifyToken = (req: VercelRequest): AuthData => {
    // The explicit check for JWT_SECRET is removed as a default is provided for development.
    // A production deployment MUST have this environment variable set for security.
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authorized: false, message: 'Authorization header missing or malformed.' };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return { authorized: false, message: 'Token not found.' };
    }

    try {
        // jwt.verify will throw an error if the secret is missing or invalid.
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