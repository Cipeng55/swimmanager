import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb';
import { verifyToken } from '../_lib/auth';
import bcrypt from 'bcryptjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  if (!authData.authorized) {
    return res.status(401).json({ message: authData.message });
  }

  const { db } = await connectToDatabase();
  const collection = db.collection('users');

  try {
    switch (req.method) {
      case 'GET': {
        if (authData.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only admins can view users.' });
        }
        // Get users from the same club, but NEVER return the password hash
        const users = await collection.find({ clubId: authData.clubId }, { projection: { password: 0 } }).toArray();
        const transformedUsers = users.map(user => {
          const { _id, ...rest } = user;
          return { id: _id.toHexString(), ...rest };
        });
        return res.status(200).json(transformedUsers);
      }

      case 'POST': { // Create a new user within the admin's club
        if (authData.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only admins can create new users.' });
        }
        const { username, password, role } = req.body;
        if (!username || !password || !role) {
          return res.status(400).json({ message: 'Username, password, and role are required.' });
        }
        
        const existingUser = await collection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (existingUser) {
          return res.status(409).json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
          username,
          password: hashedPassword,
          role,
          clubId: authData.clubId, // Assign to the admin's club
        };

        const result = await collection.insertOne(newUser);
        const { password: _, ...userToReturn } = newUser;
        return res.status(201).json({ id: result.insertedId.toHexString(), ...userToReturn });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}