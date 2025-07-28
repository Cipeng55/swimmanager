
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../_lib/mongodb.js';
import { verifyToken } from '../_lib/auth.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';


export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authData = verifyToken(req);
  if (!authData.authorized) {
    return res.status(401).json({ message: authData.message });
  }

  const { db } = await connectToDatabase();
  const { id } = req.query;

  if (typeof id !== 'string' || !ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user ID format.' });
  }
  const objectId = new ObjectId(id);
  const usersCollection = db.collection('users');

  const user = await usersCollection.findOne({ _id: objectId });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        // A generic GET for a single user isn't implemented on the frontend, but we can secure it.
        const canView = authData.role === 'superadmin' || 
                        (authData.role === 'admin' && user.createdByAdminId?.toString() === authData.userId);
        if (!canView) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        const { password, ...userData } = user;
        return res.status(200).json({ id: user._id.toHexString(), ...userData });
      }

      case 'PATCH': {
        const { password } = req.body;
        if (!password || typeof password !== 'string' || password.length < 6) {
          return res.status(400).json({ message: 'Password is required and must be at least 6 characters long.' });
        }

        let canReset = false;
        if (authData.role === 'superadmin' && user.role !== 'superadmin') {
          canReset = true;
        } else if (authData.role === 'admin' && user.role === 'user' && user.createdByAdminId?.toString() === authData.userId) {
          canReset = true;
        }

        if (!canReset) {
          return res.status(403).json({ message: "Forbidden: You don't have permission to reset this user's password." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await usersCollection.updateOne({ _id: objectId }, { $set: { password: hashedPassword } });

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'User not found during password update' });
        }
        return res.status(200).json({ message: 'Password updated successfully' });
      }
      
      case 'DELETE': {
        // Superadmin can delete any user/admin. Admins can only delete users they created.
         let canDelete = false;
         if (authData.role === 'superadmin' && user.role !== 'superadmin') {
           canDelete = true;
         } else if (authData.role === 'admin' && user.role === 'user' && user.createdByAdminId?.toString() === authData.userId) {
           canDelete = true;
         }

         if (!canDelete) {
            return res.status(403).json({ message: "Forbidden: You don't have permission to delete this user." });
         }

         const result = await usersCollection.deleteOne({ _id: objectId });
         if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'User not found during deletion' });
         }
         return res.status(204).end();
      }

      default:
        res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('API Error for /api/users/[id]:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
