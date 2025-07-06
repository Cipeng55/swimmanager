import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Please define the JWT_SECRET environment variable');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');
  const clubsCollection = db.collection('clubs');

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    let clubName = 'N/A';
    if (user.clubId) {
        const club = await clubsCollection.findOne({ _id: new (require('mongodb').ObjectId)(user.clubId) });
        if (club) {
            clubName = club.name;
        } else if (user.role === 'superadmin') {
            clubName = 'System Administration'; // Graceful fallback for superadmin
        } else {
             return res.status(500).json({ message: 'Internal Server Error: Associated club not found.' });
        }
    }


    // Create JWT payload
    const payload = {
      userId: user._id.toHexString(),
      username: user.username,
      role: user.role,
      clubId: user.clubId,
      clubName: clubName,
    };

    const token = jwt.sign(payload, JWT_SECRET!, { expiresIn: '1d' });

    return res.status(200).json({ token });

  } catch (error: any) {
    console.error('Login API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}