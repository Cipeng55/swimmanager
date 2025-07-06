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

  // Verify the event exists, respecting superadmin's global view
  const eventQuery = authData.role === 'superadmin' 
    ? { _id: new ObjectId(eventId) } 
    : { _id: new ObjectId(eventId), clubId: authData.clubId };

  const event = await eventsCollection.findOne(eventQuery);
  if (!event) {
      return res.status(404).json({ message: 'Event not found or not part of your club.' });
  }

  // Define query for program order based on role
  const orderQuery = authData.role === 'superadmin'
    ? { eventId: eventId }
    : { eventId: eventId, clubId: authData.clubId };

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
        if (authData.role !== 'admin' && authData.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden: Only admins or superadmins can save program order.' });
        }
        const { orderedRaceKeys } = req.body;
        if (!Array.isArray(orderedRaceKeys)) {
            return res.status(400).json({ message: 'orderedRaceKeys must be an array.' });
        }

        // Use the role-based query for the update, and ensure clubId is set correctly on upsert
        await programOrderCollection.updateOne(
          orderQuery,
          { $set: { orderedRaceKeys: orderedRaceKeys, clubId: event.clubId } }, // Use the actual event's clubId
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