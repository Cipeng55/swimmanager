
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
        if (!authData.authorized || (authData.role !== 'admin' && authData.role !== 'superadmin')) {
            return res.status(403).json({ message: "Forbidden: You do not have permission to view user accounts." });
        }

        let query: any = {};
        if (authData.role === 'admin') {
            // Admins can only see the 'user' (club) accounts they created.
            query.role = 'user'; 
            query.createdByAdminId = authData.userId;
        } else if (authData.role === 'superadmin') {
            // Superadmin sees both admins and users
            query.role = { $in: ['admin', 'user'] };
        }

        const users = await usersCollection.find(query, { projection: { password: 0 } }).sort({ username: 1 }).toArray();

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
        if (!authData.authorized) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { username, password, role, clubName } = req.body;
        
        // General validation
        if (!username || !password || !role) {
            return res.status(400).json({ message: 'Username, password, and role are required.' });
        }

        // Permission check based on creator's role
        if (authData.role === 'superadmin') {
            if (role !== 'user' && role !== 'admin') {
                return res.status(400).json({ message: 'Superadmin can only create roles "user" or "admin".' });
            }
        } else if (authData.role === 'admin') {
            if (role !== 'user') {
                return res.status(403).json({ message: 'Forbidden: Admins can only create accounts with the "user" role.' });
            }
        } else {
            // 'user' role cannot create accounts
            return res.status(403).json({ message: 'Forbidden: You do not have permission to create user accounts.' });
        }

        if (role === 'user' && (!clubName || clubName.trim() === '')) {
            return res.status(400).json({ message: 'Club Name is required for users with the "user" role.' });
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
            // If the account is created by an admin, tag it with their ID for filtering.
            if (authData.role === 'admin') {
                newUserDocument.createdByAdminId = authData.userId;
            }
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
