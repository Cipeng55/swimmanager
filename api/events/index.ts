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
            // Admins see events they created
            query.createdByAdminId = authData.userId;
        } else if (authData.role === 'user') {
            const usersCollection = db.collection('users');
            const userAccount = await usersCollection.findOne({ _id: new ObjectId(authData.userId) });
            const parentAdminId = userAccount?.createdByAdminId;

            const orConditions: any[] = [
                // Condition 1: User is explicitly authorized for the event
                { authorizedUserIds: authData.userId }
            ];

            // Condition 2: Event has no explicit authorization list AND was created by the user's parent admin
            if (parentAdminId) {
                orConditions.push({
                    createdByAdminId: parentAdminId.toString(),
                    $or: [
                        { authorizedUserIds: { $exists: false } },
                        { authorizedUserIds: { $eq: [] } },
                        { authorizedUserIds: { $size: 0 } }
                    ]
                });
            }
            query = { $or: orConditions };
        }
        // Superadmin gets all events (empty query falls through)

        const events = await collection.find(query).sort({ date: -1 }).toArray();
        const transformedEvents = events.map(event => {
          const { _id, ...rest } = event;
          return { id: _id.toHexString(), ...rest };
        });
        return res.status(200).json(transformedEvents);
      }
      
      case 'POST': {
        if (authData.role !== 'admin' && authData.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden: Only admins or superadmins can create events.' });
        }
        if (!authData.userId) {
             return res.status(400).json({ message: 'Authentication error: Admin user ID not found.' });
        }
        
        const eventDetails = req.body;
        
        const newEventData = { 
            ...eventDetails, 
            createdByAdminId: authData.userId,
            authorizedUserIds: eventDetails.authorizedUserIds || [] // Ensure this field is saved
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