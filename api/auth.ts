

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from './_lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

async function handleLogin(req: VercelRequest, res: VercelResponse) {
    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'Internal server configuration error: JWT_SECRET not set.' });
    }
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const clubsCollection = db.collection('clubs');
    
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
      }
      const user = await usersCollection.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password.' });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid username or password.' });
      }
      let clubName = 'N/A';
      if (user.clubId) {
          const club = await clubsCollection.findOne({ _id: new (require('mongodb').ObjectId)(user.clubId) });
          if (club) {
              clubName = club.name;
          } else if (user.role === 'superadmin') {
              clubName = 'System Administration';
          } else {
               return res.status(500).json({ message: 'Internal Server Error: Associated club not found.' });
          }
      } else if (user.role === 'superadmin') {
          clubName = 'System Administration';
      }

      const payload = {
        userId: user._id.toHexString(),
        username: user.username,
        role: user.role,
        clubId: user.clubId ? user.clubId.toHexString() : null,
        clubName: clubName,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
      return res.status(200).json({ token });
    } catch (error: any) {
      console.error('Login API Error:', error);
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}

async function handleSetup(req: VercelRequest, res: VercelResponse) {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const clubsCollection = db.collection('clubs');
  
    const SUPERADMIN_USERNAME = 'superadmin';
    const SUPERADMIN_PASSWORD = 'Cipeng55';
    const SYSTEM_CLUB_NAME = 'System Administration';
  
    try {
      const existingSuperAdmin = await usersCollection.findOne({ role: 'superadmin' });
      if (existingSuperAdmin) {
        return res.status(409).json({ message: 'Superadmin already exists. Setup cannot be run again.' });
      }
      let club = await clubsCollection.findOne({ name: SYSTEM_CLUB_NAME });
      let clubId;
      if (!club) {
          const clubResult = await clubsCollection.insertOne({ name: SYSTEM_CLUB_NAME, createdAt: new Date() });
          clubId = clubResult.insertedId;
      } else {
          clubId = club._id;
      }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!JWT_SECRET) {
      console.error('FATAL_ERROR: JWT_SECRET environment variable is not defined.');
      return res.status(500).json({ message: 'Internal server configuration error.' });
    }
    const { action } = req.query;

    if (req.method === 'POST' && action === 'login') {
      return handleLogin(req, res);
    }
  
    if (req.method === 'GET' && action === 'setup') {
      return handleSetup(req, res);
    }
    
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(404).json({ message: 'Action not found or method not allowed for /api/auth.' });
}