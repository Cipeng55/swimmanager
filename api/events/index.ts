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
  const collection = db.collection('events');

  try {
    switch (req.method) {
      case 'GET': {
        let query: any = {};
        if (authData.role === 'admin') {
            query.createdByAdminId = authData.userId;
        } else if (authData.role === 'user') {
            query.authorizedUserIds = authData.userId;
        }
        // Superadmin gets all events (empty query)

        const events = await collection.find(query).sort({ date: -1 }).toArray();
        const transformedEvents = events.map(event => {
          const { _id, ...rest } = event;
          return { id: _id.toHexString(), ...rest };
        });
        return res.status(200).json(transformedEvents);
      }
      
      case 'POST': {
        if (authData.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only admins can create events.' });
        }
        if (!authData.userId) {
             return res.status(400).json({ message: 'Authentication error: Admin user ID not found.' });
        }
        
        const { authorizedUserIds, ...eventDetails } = req.body;
        
        const newEventData = { 
            ...eventDetails, 
            createdByAdminId: authData.userId,
            authorizedUserIds: authorizedUserIds || []
        };
        const result = await collection.insertOne(newEventData);
        const insertedEvent = { id: result.insertedId.toHexString(), ...newEventData };
        return res.status(201).json(insertedEvent);
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