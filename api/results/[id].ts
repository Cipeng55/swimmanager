
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb.js';
import { verifyToken } from '../_lib/auth.js';
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

  try {
    const result = await collection.findOne({ _id: objectId });
    if (!result) {
        return res.status(404).json({ message: 'Result not found' });
    }

    const swimmer = await db.collection('swimmers').findOne({ _id: new ObjectId(result.swimmerId) });
    if (!swimmer) {
        return res.status(404).json({ message: 'Associated swimmer not found for this result.' });
    }

    const event = await db.collection('events').findOne({ _id: new ObjectId(result.eventId) });
    if (!event) {
        return res.status(404).json({ message: 'Associated event not found for this result.' });
    }

    // Permission check
    let canModify = false;
    if (authData.role === 'superadmin') {
        canModify = true;
    } else if (authData.role === 'admin' && event.createdByAdminId?.toString() === authData.userId) {
        canModify = true; // Admin who created the event can modify its results
    } else if (authData.role === 'user' && swimmer.clubUserId?.toString() === authData.userId) {
        canModify = true; // User who owns the swimmer can modify their results (but usually an admin does this from program page)
    }

    switch (req.method) {
      case 'GET': {
        // Any authenticated user can GET a specific result by ID if they know it
        const { _id, ...resultData } = result;
        return res.status(200).json({ id: _id.toHexString(), ...resultData });
      }

      case 'PUT': {
        if (!canModify) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to modify this result.' });
        }
        
        const resultData = req.body;
        const updateResult = await collection.updateOne({ _id: objectId }, { $set: resultData });
        if (updateResult.matchedCount === 0) {
          return res.status(404).json({ message: 'Result not found during update' });
        }
        return res.status(200).json({ message: 'Result updated successfully' });
      }

      case 'DELETE': {
        if (!canModify) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this result.' });
        }

        const deleteResult = await collection.deleteOne({ _id: objectId });
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
