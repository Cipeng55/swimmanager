import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb';
import { verifyToken } from '../_lib/auth';
import { ObjectId } from 'mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  if (!authData.authorized) {
    return res.status(401).json({ message: authData.message });
  }

  const { db } = await connectToDatabase();
  const { id } = req.query;

  if (typeof id !== 'string' || !ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid result ID format.' });
  }
  const objectId = new ObjectId(id);
  const collection = db.collection('results');

  const query: any = { _id: objectId, clubId: authData.clubId };
  
  try {
    switch (req.method) {
      case 'GET': {
        const result = await collection.findOne(query);
        if (!result) {
          return res.status(404).json({ message: 'Result not found or not part of your club' });
        }
        const { _id, ...resultData } = result;
        return res.status(200).json({ id: _id.toHexString(), ...resultData });
      }

      case 'PUT': {
        const existingResult = await collection.findOne(query);
        if (!existingResult) {
            return res.status(404).json({ message: 'Result not found or not part of your club' });
        }
        // Admin can edit any result in their club, users can only edit their own
        if (authData.role !== 'admin' && existingResult.createdByUserId !== authData.userId) {
            return res.status(403).json({ message: 'Forbidden: You can only edit results you created.' });
        }
        
        const resultData = req.body;
        delete resultData.clubId; // Prevent changing clubId

        const updateResult = await collection.updateOne(query, { $set: resultData });
        if (updateResult.matchedCount === 0) {
          return res.status(404).json({ message: 'Result not found during update' });
        }
        return res.status(200).json({ message: 'Result updated successfully' });
      }

      case 'DELETE': {
        const existingResult = await collection.findOne(query);
        if (!existingResult) {
            return res.status(404).json({ message: 'Result not found or not part of your club' });
        }
        // Admin can delete any result in their club, users can only delete their own
        if (authData.role !== 'admin' && existingResult.createdByUserId !== authData.userId) {
            return res.status(403).json({ message: 'Forbidden: You can only delete results you created.' });
        }

        const deleteResult = await collection.deleteOne(query);
        if (deleteResult.deletedCount === 0) {
          return res.status(404).json({ message: 'Result not found during deletion' });
        }
        return res.status(204).end();
      }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}