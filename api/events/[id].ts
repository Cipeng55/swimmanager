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
    return res.status(400).json({ message: 'Invalid event ID format.' });
  }
  const objectId = new ObjectId(id);
  const eventsCollection = db.collection('events');
  const resultsCollection = db.collection('results');
  const programOrderCollection = db.collection('programOrders');
  
  const event = await eventsCollection.findOne({ _id: objectId });
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Permission check
  const isSuperAdmin = authData.role === 'superadmin';
  const isAdminCreator = authData.role === 'admin' && event.createdByAdminId?.toString() === authData.userId;
  const isAuthorizedUser = authData.role === 'user' && event.authorizedUserIds?.includes(authData.userId);

  if (!isSuperAdmin && !isAdminCreator && !isAuthorizedUser) {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to access this event.' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const { _id, ...eventData } = event;
        return res.status(200).json({ id: _id.toHexString(), ...eventData });
      }

      case 'PUT': {
        if (!isSuperAdmin && !isAdminCreator) {
          return res.status(403).json({ message: 'Forbidden: Only the creating admin or superadmin can update events.' });
        }
        const eventData = req.body;
        delete eventData.createdByAdminId; // Cannot change creator
        
        const result = await eventsCollection.updateOne({ _id: objectId }, { $set: eventData });
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Event not found during update' });
        }
        return res.status(200).json({ message: 'Event updated successfully' });
      }

      case 'DELETE': {
        if (!isSuperAdmin && !isAdminCreator) {
          return res.status(403).json({ message: 'Forbidden: Only the creating admin or superadmin can delete events.' });
        }
        
        await resultsCollection.deleteMany({ eventId: id });
        await programOrderCollection.deleteOne({ eventId: id });
        const result = await eventsCollection.deleteOne({ _id: objectId });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Event not found during deletion' });
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
