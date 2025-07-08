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
  const { eventId } = req.query;

  if (typeof eventId !== 'string' || !ObjectId.isValid(eventId)) {
    return res.status(400).json({ message: 'Event ID must be a valid ObjectId string.' });
  }
  
  const programOrderCollection = db.collection('programOrders');
  const eventsCollection = db.collection('events');

  const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
  if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
  }

  // Comprehensive Permission Check
  let hasPermission = false;
  if (authData.role === 'superadmin') {
      hasPermission = true;
  } else if (authData.role === 'admin' && event.createdByAdminId?.toString() === authData.userId) {
      hasPermission = true;
  } else if (authData.role === 'user') {
      // 1. Check for explicit permission first
      if (event.authorizedUserIds && Array.isArray(event.authorizedUserIds) && event.authorizedUserIds.includes(authData.userId)) {
          hasPermission = true;
      } 
      // 2. If no explicit list, check for implicit permission (created by the same admin)
      else if (!event.authorizedUserIds || event.authorizedUserIds.length === 0) {
          const usersCollection = db.collection('users');
          const userAccount = await usersCollection.findOne({ _id: new ObjectId(authData.userId) });
          // Check if the user's creator admin matches the event's creator admin
          if (userAccount?.createdByAdminId?.toString() === event.createdByAdminId?.toString()) {
              hasPermission = true;
          }
      }
  }

  if (!hasPermission) {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to access the program order for this event.' });
  }
  
  const orderQuery = { eventId: eventId };

  try {
    switch (req.method) {
      case 'GET': {
        const orderDoc = await programOrderCollection.findOne(orderQuery);
        if (!orderDoc) {
          return res.status(200).json(null);
        }
        return res.status(200).json(orderDoc.orderedRaceKeys);
      }

      case 'POST': {
        // Only admins who created the event or superadmins can save/update the order
        const canModify = authData.role === 'superadmin' || (authData.role === 'admin' && event.createdByAdminId?.toString() === authData.userId);
        if (!canModify) {
            return res.status(403).json({ message: 'Forbidden: Only the creating admin or superadmin can save program order.' });
        }
        const { orderedRaceKeys } = req.body;
        if (!Array.isArray(orderedRaceKeys)) {
            return res.status(400).json({ message: 'orderedRaceKeys must be an array.' });
        }

        await programOrderCollection.updateOne(
          orderQuery,
          { $set: { orderedRaceKeys: orderedRaceKeys } },
          { upsert: true }
        );
        return res.status(200).json({ message: 'Program order saved successfully' });
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
