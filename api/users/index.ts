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

        const { username, password, role, clubId } = req.body;
        if (!username || !password) {
          return res.status(400).json({ message: 'Username and password are required.' });
        }
        
        const newUserRole = authData.role === 'superadmin' ? role : 'user';
        if (authData.role === 'admin' && role && role !== 'user') {
            return res.status(403).json({ message: 'Admins can only create Users.' });
        }
        if (authData.role === 'superadmin' && (!role || !clubId)) {
            return res.status(400).json({ message: 'Super admins must specify a role and club.' });
        }

        const newUserClubId = authData.role === 'superadmin' ? new ObjectId(clubId) : new ObjectId(authData.clubId);

        const existingUser = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (existingUser) {
          return res.status(409).json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
          username,
          password: hashedPassword,
          role: newUserRole,
          clubId: newUserClubId,
        };

        const result = await usersCollection.insertOne(newUser);
        const { password: _, ...userToReturn } = newUser;
        return res.status(201).json({ id: result.insertedId.toHexString(), ...userToReturn, clubId: newUserClubId.toHexString() });
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