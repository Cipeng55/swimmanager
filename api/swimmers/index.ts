import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb';
import { verifyToken } from '../_lib/auth';

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
        const swimmers = await collection.find({ clubId: authData.clubId }).sort({ name: 1 }).toArray();
        const transformedSwimmers = swimmers.map(swimmer => {
          const { _id, ...rest } = swimmer;
          return { id: _id.toHexString(), ...rest };
        });
        return res.status(200).json(transformedSwimmers);
      }
      
      case 'POST': {
        const newSwimmerData = { 
            ...req.body, 
            clubId: authData.clubId,
            createdByUserId: authData.userId 
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