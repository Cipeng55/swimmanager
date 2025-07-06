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
    const { username, password, clubName } = req.body;
    if (!username || !password || !clubName) {
      return res.status(400).json({ message: 'Username, password, and club name are required.' });
    }
     if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    // Check if username already exists
    const existingUser = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists.' });
    }
    
    // Check if club name already exists
    const existingClub = await clubsCollection.findOne({ name: { $regex: new RegExp(`^${clubName}$`, 'i') } });
    if (existingClub) {
      return res.status(409).json({ message: 'Club name already exists.' });
    }

    // 1. Create the new club
    const newClub = { name: clubName, createdAt: new Date() };
    const clubResult = await clubsCollection.insertOne(newClub);
    const clubId = clubResult.insertedId.toHexString();

    // 2. Create the new user (as admin of the new club)
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      username,
      password: hashedPassword,
      role: 'admin', // First user of a club is an admin
      clubId: clubId,
    };
    const userResult = await usersCollection.insertOne(newUser);
    const userId = userResult.insertedId.toHexString();

    // 3. Create and return JWT
    const payload = {
      userId: userId,
      username: newUser.username,
      role: newUser.role,
      clubId: newUser.clubId,
      clubName: newClub.name,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

    return res.status(201).json({ token });

  } catch (error: any) {
    console.error('Registration API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}