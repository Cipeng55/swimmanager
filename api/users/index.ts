import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb';
import { verifyToken } from '../_lib/auth';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  if (!authData.authorized || !authData.role) {
    return res.status(401).json({ message: authData.message || "Unauthorized" });
  }

  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');

  try {
    switch (req.method) {
      case 'GET': {
        if (authData.role !== 'admin' && authData.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to view users.' });
        }
        
        let query = {};
        if (authData.role === 'admin') {
            query = { clubId: authData.clubId };
        }
        // Superadmin gets all users (empty query)

        // Join with clubs to get clubName
        const users = await usersCollection.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'clubs',
                    localField: 'clubId',
                    foreignField: '_id',
                    as: 'clubInfo'
                }
            },
            { $unwind: { path: '$clubInfo', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    password: 0, // Exclude password
                    clubId: { $toString: "$clubId" }, // ensure clubId is string
                    _id: 1,
                    username: 1,
                    role: 1,
                    clubName: '$clubInfo.name'
                }
            }
        ]).sort({ clubName: 1, username: 1 }).toArray();

        const transformedUsers = users.map(user => {
          const { _id, ...rest } = user;
          return { id: _id.toHexString(), ...rest };
        });

        return res.status(200).json(transformedUsers);
      }

      case 'POST': { // Create a new user
        if (authData.role !== 'admin' && authData.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to create users.' });
        }

        const { username, password } = req.body;
        if (!username || !password) {
          return res.status(400).json({ message: 'Username and password are required.' });
        }

        const existingUser = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (existingUser) {
          return res.status(409).json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let newUserDocument;

        if (authData.role === 'superadmin') {
            // Superadmin creates a user with 'user' role and no club affiliation yet.
            newUserDocument = {
              username,
              password: hashedPassword,
              role: 'user', // Default role
              clubId: null, // No club assigned on creation by superadmin
            };
        } else { // Admin role
            // Admin creates a user within their own club.
            newUserDocument = {
              username,
              password: hashedPassword,
              role: 'user',
              clubId: new ObjectId(authData.clubId),
            };
        }

        const result = await usersCollection.insertOne(newUserDocument);
        const { password: _, ...userToReturn } = newUserDocument;

        // Ensure clubId is stringified for the response if it exists
        if (userToReturn.clubId) {
            // @ts-ignore
            userToReturn.clubId = userToReturn.clubId.toHexString();
        }

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