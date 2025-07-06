import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb';
import { verifyToken } from '../_lib/auth';

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
        const query = authData.role === 'superadmin' ? {} : { clubId: authData.clubId };
        const results = await collection.find(query).sort({ dateRecorded: -1 }).toArray();
        const transformedResults = results.map(result => {
          const { _id, ...rest } = result;
          return { id: _id.toHexString(), ...rest };
        });
        return res.status(200).json(transformedResults);
      }
      
      case 'POST': {
        const newResultData = { 
            ...req.body,
            clubId: authData.clubId,
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