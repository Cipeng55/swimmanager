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
    return res.status(400).json({ message: 'Invalid event ID format.' });
  }
  const objectId = new ObjectId(id);
  const eventsCollection = db.collection('events');
  const resultsCollection = db.collection('results');
  const programOrderCollection = db.collection('programOrders');

  const query = authData.role === 'superadmin' 
    ? { _id: objectId }
    : { _id: objectId, clubId: authData.clubId };

  try {
    switch (req.method) {
      case 'GET': {
        const event = await eventsCollection.findOne(query);
        if (!event) {
          return res.status(404).json({ message: 'Event not found or not part of your club' });
        }
        const { _id, ...eventData } = event;
        return res.status(200).json({ id: _id.toHexString(), ...eventData });
      }

      case 'PUT': {
        if (authData.role !== 'admin' && authData.role !== 'superadmin') {
          return res.status(403).json({ message: 'Forbidden: Only admins or superadmins can update events.' });
        }
        const eventData = req.body;
        // Ensure clubId isn't overwritten
        delete eventData.clubId;
        const result = await eventsCollection.updateOne(query, { $set: eventData });
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Event not found or not part of your club' });
        }
        return res.status(200).json({ message: 'Event updated successfully' });
      }

      case 'DELETE': {
        if (authData.role !== 'admin' && authData.role !== 'superadmin') {
          return res.status(403).json({ message: 'Forbidden: Only admins or superadmins can delete events.' });
        }
        const eventToDelete = await eventsCollection.findOne(query);
        if (!eventToDelete) {
          return res.status(404).json({ message: 'Event not found or not part of your club' });
        }

        // Cascade delete using event ID string
        await resultsCollection.deleteMany({ eventId: id }); // Superadmin can delete results from any club for this event
        await programOrderCollection.deleteOne({ eventId: id }); // Superadmin can delete program order from any club for this event
        const result = await eventsCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          // This case should be rare due to the check above but is a good safeguard
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