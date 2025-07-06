import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb';
import { verifyToken } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  if (!authData.authorized) {
    return res.status(401).json({ message: authData.message });
  }

  const { db } = await connectToDatabase();
  const { eventId } = req.query;

  if (typeof eventId !== 'string') {
    return res.status(400).json({ message: 'Event ID is required.' });
  }
  
  const programOrderCollection = db.collection('programOrders');
  const eventsCollection = db.collection('events');

  // Verify the event belongs to the user's club before proceeding
  const event = await eventsCollection.findOne({ _id: new (require('mongodb').ObjectId)(eventId), clubId: authData.clubId });
  if (!event) {
      return res.status(404).json({ message: 'Event not found or not part of your club.' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const orderDoc = await programOrderCollection.findOne({ eventId: eventId, clubId: authData.clubId });
        if (!orderDoc) {
          return res.status(200).json(null);
        }
        return res.status(200).json(orderDoc.orderedRaceKeys);
      }

      case 'POST': {
        if (authData.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only admins can save program order.' });
        }
        const { orderedRaceKeys } = req.body;
        if (!Array.isArray(orderedRaceKeys)) {
            return res.status(400).json({ message: 'orderedRaceKeys must be an array.' });
        }
        await programOrderCollection.updateOne(
          { eventId: eventId, clubId: authData.clubId },
          { $set: { orderedRaceKeys: orderedRaceKeys, clubId: authData.clubId } },
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