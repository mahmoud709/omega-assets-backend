import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export const register = async (req: Request, res: Response) => {
   try {
      let { email, password, fullName, role, siteId } = req.body;
      email = email?.toLowerCase().trim();

      // Check if user exists
      const existing = await User.findOne({ email });
      if (existing) {
         return res.status(400).json({ message: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = new User({
         email,
         passwordHash,
         fullName,
         role: role || 'viewer',
         siteId,
      });
      await user.save();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET as string, { expiresIn: '7d' });

      res.status(201).json({ message: 'User registered successfully', token, user: { id: user._id, email: user.email, fullName: user.fullName, role: user.role } });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const login = async (req: Request, res: Response) => {
   try {
      let { email, password } = req.body;
      email = email?.toLowerCase().trim();

      const user = await User.findOne({ email });
      if (!user) {
         console.log(`Login failed: User not found for email: ${email}`);
         return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
         console.log(`Login failed: Password mismatch for email: ${email}`);
         return res.status(401).json({ message: 'Invalid credentials' });
      }

      console.log(`Login success: ${email}`);

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET as string, { expiresIn: '7d' });

      res.status(200).json({
         token,
         user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            siteId: user.siteId,
         },
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};