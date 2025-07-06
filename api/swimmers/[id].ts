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
    return res.status(400).json({ message: 'Invalid swimmer ID format.' });
  }
  const objectId = new ObjectId(id);
  const swimmersCollection = db.collection('swimmers');
  const resultsCollection = db.collection('results');

  const query = authData.role === 'superadmin' 
    ? { _id: objectId }
    : { _id: objectId, clubId: authData.clubId };

  try {
    switch (req.method) {
      case 'GET': {
        const swimmer = await swimmersCollection.findOne(query);
        if (!swimmer) {
          return res.status(404).json({ message: 'Swimmer not found or not part of your club' });
        }
        const { _id, ...swimmerData } = swimmer;
        return res.status(200).json({ id: _id.toHexString(), ...swimmerData });
      }

      case 'PUT': {
        if (authData.role !== 'admin' && authData.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden: Only admins or superadmins can update swimmers.' });
        }
        const swimmerData = req.body;
        delete swimmerData.clubId; // Prevent changing clubId

        const result = await swimmersCollection.updateOne(query, { $set: swimmerData });
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Swimmer not found or not part of your club' });
        }
        return res.status(200).json({ message: 'Swimmer updated successfully' });
      }

      case 'DELETE': {
        if (authData.role !== 'admin' && authData.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden: Only admins or superadmins can delete swimmers.' });
        }
        
        // Ensure swimmer exists before deleting
        const swimmerToDelete = await swimmersCollection.findOne(query);
        if (!swimmerToDelete) {
             return res.status(404).json({ message: 'Swimmer not found or not part of your club' });
        }

        // Cascade delete associated results
        await resultsCollection.deleteMany({ swimmerId: id });
        
        const result = await swimmersCollection.deleteOne(query);
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Swimmer not found during deletion' });
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