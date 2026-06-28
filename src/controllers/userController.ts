import { Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcrypt';

export const getUsers = async (req: AuthRequest, res: Response) => {
   try {
      const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
      res.status(200).json({ message: 'Users retrieved', data: users });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const createUser = async (req: AuthRequest, res: Response) => {
   try {
      const { email, password, fullName, role, siteId } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
         return res.status(400).json({ message: 'User already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = new User({
         email: normalizedEmail,
         passwordHash,
         fullName,
         role: role || 'viewer',
         siteId: siteId || undefined,
      });
      await user.save();

      res.status(201).json({ message: 'User created successfully', user: { id: user._id, email: user.email, fullName: user.fullName, role: user.role } });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const { role, siteId, password, fullName } = req.body;
      const user = await User.findById(id);

      if (!user) {
         return res.status(404).json({ message: 'User not found' });
      }

      if (role) user.role = role;
      if (siteId !== undefined) {
         user.siteId = siteId ? siteId : null;
      }
      if (fullName) user.fullName = fullName;

      if (password) {
         const salt = await bcrypt.genSalt(10);
         user.passwordHash = await bcrypt.hash(password, salt);
      }

      await user.save();
      res.status(200).json({ message: 'User updated successfully', user: { id: user._id, email: user.email, fullName: user.fullName, role: user.role } });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const user = await User.findByIdAndDelete(id);

      if (!user) {
         return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json({ message: 'User deleted successfully' });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};
