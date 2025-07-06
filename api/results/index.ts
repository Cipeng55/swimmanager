import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb.js';
import { verifyToken } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  if (!authData.authorized) {
    return res.status(401).json({ message: authData.message });
  }
  
  const { db } = await connectToDatabase();
  const collection = db.collection('results');

  try {
    switch (req.method) {
      case 'GET': {
        let query: any = {};
        if (authData.role === 'user' && authData.userId) {
          // Get all swimmers for the user's club
          const swimmers = await db.collection('swimmers').find({ clubUserId: authData.userId }).project({ _id: 1 }).toArray();
          const swimmerIds = swimmers.map(s => s._id.toHexString());
          query.swimmerId = { $in: swimmerIds };
        } else if (authData.role === 'admin' && authData.userId) {
          // Get all events created by the admin
          const events = await db.collection('events').find({ createdByAdminId: authData.userId }).project({ _id: 1 }).toArray();
          const eventIds = events.map(e => e._id.toHexString());
          query.eventId = { $in: eventIds };
        }
        // Superadmin gets all results

        const results = await collection.find(query).sort({ dateRecorded: -1 }).toArray();
        const transformedResults = results.map(result => {
          const { _id, ...rest } = result;
          return { id: _id.toHexString(), ...rest };
        });
        return res.status(200).json(transformedResults);
      }
      
      case 'POST': {
        if (authData.role !== 'user') {
          return res.status(403).json({ message: 'Forbidden: Only users with role "user" (clubs) can submit results.' });
        }
        const swimmer = await db.collection('swimmers').findOne({ _id: req.body.swimmerId });
        if (!swimmer || swimmer.clubUserId !== authData.userId) {
            return res.status(403).json({ message: "Forbidden: You can only submit results for swimmers in your own club." });
        }
        const newResultData = { 
            ...req.body,
            createdByUserId: authData.userId,
        };
        const result = await collection.insertOne(newResultData);
        const insertedResult = { id: result.insertedId.toHexString(), ...newResultData };
        return res.status(201).json(insertedResult);
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
