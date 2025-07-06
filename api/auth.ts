import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from './_lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

async function handleLogin(req: VercelRequest, res: VercelResponse) {
    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'Internal server configuration error: JWT_SECRET not set.' });
    }
    
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    // Hardcoded superadmin check
    if (username === 'superadmin') {
        if (password === 'Cipeng55') {
            const payload = {
                userId: 'superadmin_static_id', // Static ID for the hardcoded superadmin
                username: 'superadmin',
                role: 'superadmin',
                clubId: null, // Superadmin is not tied to a specific club from the DB
                clubName: 'System Administration',
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
            return res.status(200).json({ token });
        } else {
            // Wrong password for superadmin, fail immediately
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
    }

    // Regular user login logic
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const clubsCollection = db.collection('clubs');
    
    try {
      // Find user, but exclude any 'superadmin' user from the DB to avoid conflicts.
      const user = await usersCollection.findOne({ 
          username: { $regex: new RegExp(`^${username}$`, 'i') },
          role: { $ne: 'superadmin' } // Do not allow login to db-based superadmins
      });

      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password.' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid username or password.' });
      }
      
      if (!user.clubId) {
          // This should not happen for admin/user roles based on creation logic.
          return res.status(500).json({ message: 'Data integrity error: User is missing a club affiliation.' });
      }
      const club = await clubsCollection.findOne({ _id: new (require('mongodb').ObjectId)(user.clubId) });
      if (!club) {
          return res.status(500).json({ message: 'Internal Server Error: Associated club not found.' });
      }
      const clubName = club.name;

      const payload = {
        userId: user._id.toHexString(),
        username: user.username,
        role: user.role,
        clubId: user.clubId.toHexString(), // clubId should exist here
        clubName: clubName,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
      return res.status(200).json({ token });
    } catch (error: any) {
      console.error('Login API Error:', error);
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!JWT_SECRET) {
      console.error('FATAL_ERROR: JWT_SECRET environment variable is not defined.');
      return res.status(500).json({ message: 'Internal server configuration error.' });
    }
    const { action } = req.query;

    if (req.method === 'POST' && action === 'login') {
      return handleLogin(req, res);
    }
    
    res.setHeader('Allow', ['POST']);
    return res.status(404).json({ message: 'Action not found or method not allowed for /api/auth. Use /api/auth?action=login' });
}
