
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from './_lib/mongodb.js';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure-default-dev-secret-please-replace-in-production';

/**
 * Handles login for regular users (admin, user) by connecting to the database.
 */
async function handleRegularUserLogin(req: VercelRequest, res: VercelResponse) {
    const { username, password } = req.body;

    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') },
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        let displayClubName: string | null = null;
        
        if (user.role === 'user') {
            if (!user.clubName) {
                return res.status(500).json({ message: 'Data integrity error: This user account is missing a club name.' });
            }
            displayClubName = user.clubName;
        } else if (user.role === 'admin') {
            displayClubName = 'Event Organizer'; // Display name for admins
        }
        // Superadmin is handled separately and doesn't reach here.

        const payload = {
            userId: user._id.toHexString(),
            username: user.username,
            role: user.role,
            // For a user, their own ID serves as their unique club identifier. Admins have no club.
            clubId: user.role === 'user' ? user._id.toHexString() : null, 
            clubName: displayClubName,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
        return res.status(200).json({ token });

    } catch (error: any) {
        console.error('Regular User Login API Error:', error);
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
                clubId: null, // Superadmin is not a club
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
