import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// WARNING: Using a default secret for development. This is insecure and should be
// replaced with a strong, unique secret in a production environment by setting
// the JWT_SECRET environment variable.
const JWT_SECRET = process.env.JWT_SECRET || 'insecure-default-dev-secret-please-replace-in-production';

/**
 * Handles login for regular users by connecting to the database.
 * The database connection module is imported dynamically to avoid breaking
 * the superadmin login if the DB module fails to load.
 */
async function handleRegularUserLogin(req: VercelRequest, res: VercelResponse) {
    // Dynamic import for database connection and ObjectId
    const { connectToDatabase } = await import('./_lib/mongodb.js');
    const { ObjectId } = await import('mongodb');

    const { username, password } = req.body;

    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');
        const clubsCollection = db.collection('clubs');

        const user = await usersCollection.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') },
            role: { $ne: 'superadmin' }
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        if (!user.clubId) {
            return res.status(500).json({ message: 'Data integrity error: User is missing a club affiliation.' });
        }
        
        const club = await clubsCollection.findOne({ _id: new ObjectId(user.clubId) });
        if (!club) {
            return res.status(500).json({ message: 'Internal Server Error: Associated club not found.' });
        }
        const clubName = club.name;

        const payload = {
            userId: user._id.toHexString(),
            username: user.username,
            role: user.role,
            clubId: user.clubId.toHexString(),
            clubName: clubName,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        return res.status(200).json({ token });
    } catch (error: any) {
        console.error('Regular User Login API Error:', error);
        if (error.code === 'ERR_MODULE_NOT_FOUND' || (error.message && error.message.includes('connect'))) {
            return res.status(500).json({ message: 'Database connection failed.' });
        }
        return res.status(500).json({ message: 'An internal error occurred during login.', error: error.message });
    }
}


/**
 * Main login handler. Checks for superadmin first, then delegates to regular user login.
 */
async function handleLogin(req: VercelRequest, res: VercelResponse) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    // Hardcoded superadmin check (case-insensitive) - NO DATABASE INTERACTION
    if (username.toLowerCase() === 'superadmin') {
        if (password === 'Cipeng55') {
            const payload = {
                userId: 'superadmin_static_id',
                username: 'superadmin',
                role: 'superadmin',
                clubId: null,
                clubName: 'System Administration',
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
            return res.status(200).json({ token });
        } else {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
    }

    // For all other users, delegate to the handler that connects to the DB
    return handleRegularUserLogin(req, res);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    if (req.method === 'POST' && action === 'login') {
        return handleLogin(req, res);
    }

    res.setHeader('Allow', ['POST']);
    return res.status(404).json({ message: 'Action not found or method not allowed for /api/auth. Use /api/auth?action=login' });
}