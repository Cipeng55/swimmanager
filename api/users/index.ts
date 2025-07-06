
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb.js';
import { verifyToken } from '../_lib/auth.js';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  
  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');

  try {
    switch (req.method) {
      case 'GET': {
        // Any authenticated user can get a list of users, but POST is restricted.
        if (!authData.authorized) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const users = await usersCollection.find({}, { projection: { password: 0 } }).sort({ username: 1 }).toArray();

        const transformedUsers = users.map(user => {
          const { _id, ...rest } = user;
          return { 
            id: _id.toHexString(), 
            ...rest 
          };
        });

        return res.status(200).json(transformedUsers);
      }

      case 'POST': {
        // Only Superadmin can create new user accounts
        if (!authData.authorized || authData.role !== 'superadmin') {
            return res.status(403).json({ message: "Forbidden: You do not have permission to create user accounts." });
        }

        const { username, password, role, clubName } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ message: 'Username, password, and role are required.' });
        }
        if (role === 'user' && (!clubName || clubName.trim() === '')) {
            return res.status(400).json({ message: 'Club Name is required for users with the "user" role.' });
        }
        if (role !== 'user' && role !== 'admin') {
            return res.status(400).json({ message: 'Role must be either "user" or "admin".' });
        }
        
        const existingUser = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (existingUser) {
          return res.status(409).json({ message: 'Username already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUserDocument: any = {
            username,
            password: hashedPassword,
            role,
        };

        if (role === 'user') {
            newUserDocument.clubName = clubName.trim();
        }

        const result = await usersCollection.insertOne(newUserDocument);
        const { password: _, ...userToReturn } = newUserDocument;
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
