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
        const canView = authData.role === 'superadmin' || 
                        (authData.role === 'admin' && user.createdByAdminId?.toString() === authData.userId);
        if (!canView) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        const { password, ...userData } = user;
        return res.status(200).json({ id: user._id.toHexString(), ...userData });
      }

      case 'PATCH': {
        const { password, status } = req.body;
        
        if (!password && !status) {
          return res.status(400).json({ message: "Request must include 'password' or 'status' to update." });
        }

        const updateFields: any = {};

        if (password) {
            if (typeof password !== 'string' || password.length < 6) {
                return res.status(400).json({ message: 'Password is required and must be at least 6 characters long.' });
            }
            let canResetPassword = false;
            if (authData.role === 'superadmin' && user.role !== 'superadmin') {
                canResetPassword = true;
            } else if (authData.role === 'admin' && user.role === 'user' && user.createdByAdminId?.toString() === authData.userId) {
                canResetPassword = true;
            }
            if (!canResetPassword) {
                return res.status(403).json({ message: "Forbidden: You don't have permission to reset this user's password." });
            }
            updateFields.password = await bcrypt.hash(password, 10);
        }

        if (status) {
            if (status !== 'active' && status !== 'inactive') {
                return res.status(400).json({ message: "Invalid status. Must be 'active' or 'inactive'." });
            }
            if (authData.role !== 'superadmin') {
                return res.status(403).json({ message: "Forbidden: Only a Super Admin can change a user's status." });
            }
            if (user.role === 'superadmin') {
                return res.status(403).json({ message: "Forbidden: Cannot change status of a Super Admin." });
            }
            updateFields.status = status;
        }

        if (Object.keys(updateFields).length > 0) {
            const result = await usersCollection.updateOne({ _id: objectId }, { $set: updateFields });
            if (result.matchedCount === 0) {
                return res.status(404).json({ message: 'User not found during update' });
            }
            return res.status(200).json({ message: 'User updated successfully' });
        }
        
        return res.status(400).json({ message: 'No valid update operation performed.' });
      }
      
      case 'DELETE': {
        let canDelete = false;
        if (authData.role === 'superadmin' && user.role !== 'superadmin') {
          canDelete = true;
        } else if (authData.role === 'admin' && user.role === 'user' && user.createdByAdminId?.toString() === authData.userId) {
          canDelete = true;
        }

        if (!canDelete) {
           return res.status(403).json({ message: "Forbidden: You don't have permission to delete this user." });
        }
        
        const swimmersCollection = db.collection('swimmers');
        const resultsCollection = db.collection('results');

        // Cascade delete logic
        if (user.role === 'user') {
            // Deleting a club account.
            const swimmersToDelete = await swimmersCollection.find({ clubUserId: id }).project({ _id: 1 }).toArray();
            if (swimmersToDelete.length > 0) {
                const swimmerIds = swimmersToDelete.map(s => s._id.toHexString());
                await resultsCollection.deleteMany({ swimmerId: { $in: swimmerIds } });
                await swimmersCollection.deleteMany({ _id: { $in: swimmersToDelete.map(s => s._id) } });
            }
        } else if (user.role === 'admin' && authData.role === 'superadmin') {
            // Superadmin deleting an admin account.
            const usersCreatedByAdmin = await usersCollection.find({ createdByAdminId: id }).project({ _id: 1 }).toArray();
            if (usersCreatedByAdmin.length > 0) {
                for (const userToDelete of usersCreatedByAdmin) {
                    const userIdString = userToDelete._id.toHexString();
                    const swimmersToDelete = await swimmersCollection.find({ clubUserId: userIdString }).project({ _id: 1 }).toArray();
                    if (swimmersToDelete.length > 0) {
                        const swimmerIds = swimmersToDelete.map(s => s._id.toHexString());
                        await resultsCollection.deleteMany({ swimmerId: { $in: swimmerIds } });
                        await swimmersCollection.deleteMany({ _id: { $in: swimmersToDelete.map(s => s._id) } });
                    }
                }
                await usersCollection.deleteMany({ _id: { $in: usersCreatedByAdmin.map(u => u._id) } });
            }
        }

        // Finally, delete the user/admin itself.
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