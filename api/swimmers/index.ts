
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
  const collection = db.collection('swimmers');

  try {
    switch (req.method) {
      case 'GET': {
        let query: any = {};
        if (authData.role === 'user' && authData.userId) {
          query.clubUserId = authData.userId;
        }
        // Admins and Superadmins can see all swimmers (empty query)
        
        const swimmers = await collection.find(query).sort({ name: 1 }).toArray();
        const transformedSwimmers = swimmers.map(swimmer => {
          const { _id, ...rest } = swimmer;
          return { id: _id.toHexString(), ...rest };
        });
        return res.status(200).json(transformedSwimmers);
      }
      
      case 'POST': {
        let swimmerPayload: any;

        if (authData.role === 'user') {
          if (!authData.userId || !authData.clubName) {
            return res.status(400).json({ message: "Cannot create swimmer: user's club information is missing." });
          }
          swimmerPayload = { 
            ...req.body, 
            clubUserId: authData.userId,
            clubName: authData.clubName
          };
        } else if (authData.role === 'admin' || authData.role === 'superadmin') {
          const { clubUserId, ...restOfBody } = req.body;
          if (!clubUserId || !ObjectId.isValid(clubUserId)) {
            return res.status(400).json({ message: "clubUserId is required for admins creating swimmers and must be a valid ID." });
          }
          const clubUser = await db.collection('users').findOne({ _id: new ObjectId(clubUserId), role: 'user' });
          if (!clubUser) {
            return res.status(404).json({ message: `Club with ID ${clubUserId} not found.` });
          }
          swimmerPayload = {
            ...restOfBody,
            clubUserId: clubUser._id.toHexString(),
            clubName: clubUser.clubName,
          };
        } else {
          return res.status(403).json({ message: 'Forbidden: You do not have permission to create swimmers.' });
        }

        const result = await collection.insertOne(swimmerPayload);
        const insertedSwimmer = { id: result.insertedId.toHexString(), ...swimmerPayload };
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
