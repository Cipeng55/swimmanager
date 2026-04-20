
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
    return res.status(400).json({ message: 'Invalid swimmer ID format.' });
  }
  const objectId = new ObjectId(id);
  const swimmersCollection = db.collection('swimmers');
  const resultsCollection = db.collection('results');

  try {
    const swimmer = await swimmersCollection.findOne({ _id: objectId });
    if (!swimmer) {
        return res.status(404).json({ message: 'Swimmer not found' });
    }

    let canModify = false;
    if (authData.role === 'superadmin') {
        canModify = true;
    } else if (authData.role === 'user' && swimmer.clubUserId?.toString() === authData.userId) {
        canModify = true;
    } else if (authData.role === 'admin' && swimmer.clubUserId) {
        const clubUser = await db.collection('users').findOne({ _id: new ObjectId(swimmer.clubUserId.toString()) });
        if (clubUser && clubUser.createdByAdminId?.toString() === authData.userId) {
            canModify = true;
        }
    }

    switch (req.method) {
      case 'GET': {
        if (!canModify) {
            // GET might have broader view permissions for any admin/user, but for simplicity we reuse canModify
            // For this app's logic, if you can't modify, you probably shouldn't be viewing via direct ID link either.
            const canView = authData.role === 'admin'; // Any admin can view details
             if (!canView && !canModify) {
                 return res.status(403).json({ message: 'Forbidden: You do not have permission to view this swimmer.' });
             }
        }
        const { _id, ...swimmerData } = swimmer;
        return res.status(200).json({ id: _id.toHexString(), ...swimmerData });
      }

      case 'PUT': {
        if (!canModify) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to modify this swimmer.' });
        }

        const swimmerData = req.body;
        // Prevent changing ownership details
        delete swimmerData.clubUserId;
        delete swimmerData.clubName;

        const result = await swimmersCollection.updateOne({ _id: objectId }, { $set: swimmerData });
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Swimmer not found during update operation' });
        }
        return res.status(200).json({ message: 'Swimmer updated successfully' });
      }

      case 'DELETE': {
        if (!canModify) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this swimmer.' });
        }

        // Cascade delete associated results
        await resultsCollection.deleteMany({ swimmerId: id });
        
        const result = await swimmersCollection.deleteOne({ _id: objectId });
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
