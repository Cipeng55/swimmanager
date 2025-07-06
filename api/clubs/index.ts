import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb.js';
import { verifyToken } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  // Only superadmin can manage clubs
  if (!authData.authorized || authData.role !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to manage clubs.' });
  }

  const { db } = await connectToDatabase();
  const collection = db.collection('clubs');

  try {
    switch (req.method) {
      case 'GET': {
        const clubs = await collection.find({}).sort({ name: 1 }).toArray();
        const transformedClubs = clubs.map(club => {
          const { _id, ...rest } = club;
          return { id: _id.toHexString(), ...rest };
        });
        return res.status(200).json(transformedClubs);
      }
      
      case 'POST': {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ message: 'Club name is required and must be a non-empty string.' });
        }

        const existingClub = await collection.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
        if (existingClub) {
            return res.status(409).json({ message: 'A club with this name already exists.' });
        }

        const newClubData = { name: name.trim(), createdAt: new Date() };
        const result = await collection.insertOne(newClubData);
        const insertedClub = { id: result.insertedId.toHexString(), ...newClubData };

        return res.status(201).json(insertedClub);
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