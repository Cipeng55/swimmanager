import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb.js';
import { verifyToken } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  if (!authData.authorized) {
    return res.status(401).json({ message: authData.message });
  }
  
  const { db } = await connectToDatabase();
  const collection = db.collection('swimmers');

  try {
    switch (req.method) {
      case 'GET': {
        let query: any = {};
        if (authData.role === 'user' && authData.userId) {
          query.clubUserId = authData.userId;
        }
        // Admins and Superadmins can see all swimmers
        
        const swimmers = await collection.find(query).sort({ name: 1 }).toArray();
        const transformedSwimmers = swimmers.map(swimmer => {
          const { _id, ...rest } = swimmer;
          return { id: _id.toHexString(), ...rest };
        });
        return res.status(200).json(transformedSwimmers);
      }
      
      case 'POST': {
        if (authData.role !== 'user') {
          return res.status(403).json({ message: 'Forbidden: Only users of role "user" (clubs) can create swimmers.' });
        }
        if (!authData.userId || !authData.clubName) {
            return res.status(400).json({ message: "Cannot create swimmer: user's club information is missing." });
        }

        const newSwimmerData = { 
            ...req.body, 
            clubUserId: authData.userId,
            clubName: authData.clubName
        };
        const result = await collection.insertOne(newSwimmerData);
        const insertedSwimmer = { id: result.insertedId.toHexString(), ...newSwimmerData };
        return res.status(201).json(insertedSwimmer);
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
