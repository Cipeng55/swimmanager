import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb.js';
import { verifyToken } from '../_lib/auth.js';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  if (!authData.authorized || authData.role !== 'superadmin') {
    return res.status(403).json({ message: "Forbidden: Only superadmins can manage user accounts." });
  }

  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');

  try {
    switch (req.method) {
      case 'GET': {
        const query = {}; // Superadmin gets all users

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
                    password: 0, // Exclude password from the result
                    'clubInfo._id': 0,
                    'clubInfo.createdAt': 0
                }
            }
        ]).sort({ 'clubInfo.name': 1, username: 1 }).toArray();

        const transformedUsers = users.map(user => {
          const { _id, clubId, clubInfo, ...rest } = user;
          return { 
            id: _id.toHexString(), 
            clubId: clubId ? clubId.toHexString() : null,
            clubName: clubInfo?.name || null,
            ...rest 
          };
        });

        return res.status(200).json(transformedUsers);
      }

      case 'POST': { // Create a new user (Superadmin only)
        const { username, password, role, clubId, newClubName } = req.body;
        if (!username || !password || !role) {
          return res.status(400).json({ message: 'Username, password, and role are required.' });
        }

        if (role !== 'admin' && role !== 'user') {
            return res.status(400).json({ message: "Superadmins can only create 'admin' or 'user' roles." });
        }

        const existingUser = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (existingUser) {
          return res.status(409).json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let clubIdForNewUser: ObjectId;

        if (newClubName) {
            const clubsCollection = db.collection('clubs');
            const existingClub = await clubsCollection.findOne({ name: { $regex: new RegExp(`^${newClubName.trim()}$`, 'i') } });
            if (existingClub) {
                return res.status(409).json({ message: `Club "${newClubName}" already exists.` });
            }
            const newClubDoc = { name: newClubName.trim(), createdAt: new Date() };
            const clubResult = await clubsCollection.insertOne(newClubDoc);
            clubIdForNewUser = clubResult.insertedId;
        } else if (clubId && ObjectId.isValid(clubId)) {
            clubIdForNewUser = new ObjectId(clubId);
            const clubsCollection = db.collection('clubs');
            if (!(await clubsCollection.findOne({ _id: clubIdForNewUser }))) {
                return res.status(400).json({ message: `Club with ID ${clubId} not found.` });
            }
        } else {
            return res.status(400).json({ message: "A club assignment (either existing or new) is required for this role." });
        }
        
        const newUserDocument = {
          username,
          password: hashedPassword,
          role,
          clubId: clubIdForNewUser,
        };

        const result = await usersCollection.insertOne(newUserDocument);
        const { password: _, ...userToReturn } = newUserDocument;

        return res.status(201).json({ id: result.insertedId.toHexString(), ...userToReturn, clubId: clubIdForNewUser.toHexString() });
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