import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb';
import bcrypt from 'bcryptjs';

// WARNING: This endpoint is for initial setup only.
// It is recommended to secure or remove this endpoint after first use.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');
  const clubsCollection = db.collection('clubs');

  const SUPERADMIN_USERNAME = 'superadmin';
  const SUPERADMIN_PASSWORD = 'Cipeng55'; // As requested
  const SYSTEM_CLUB_NAME = 'System Administration';

  try {
    // 1. Check if a superadmin already exists
    const existingSuperAdmin = await usersCollection.findOne({ role: 'superadmin' });
    if (existingSuperAdmin) {
      return res.status(409).json({ message: 'Superadmin already exists. Setup cannot be run again.' });
    }

    // 2. Create the System Club
    let club = await clubsCollection.findOne({ name: SYSTEM_CLUB_NAME });
    let clubId;
    if (!club) {
        const clubResult = await clubsCollection.insertOne({ name: SYSTEM_CLUB_NAME, createdAt: new Date() });
        clubId = clubResult.insertedId;
    } else {
        clubId = club._id;
    }

    // 3. Create the superadmin user
    const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
    const newUser = {
      username: SUPERADMIN_USERNAME,
      password: hashedPassword,
      role: 'superadmin',
      clubId: clubId,
    };
    await usersCollection.insertOne(newUser);

    return res.status(201).json({
      message: 'Superadmin created successfully.',
      username: SUPERADMIN_USERNAME,
      club: SYSTEM_CLUB_NAME,
    });

  } catch (error: any) {
    console.error('Superadmin Setup Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}