import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async (): Promise<void> => {
   try {
      await mongoose.connect(process.env.MONGODB_URI as string, {
         serverSelectionTimeoutMS: 10000,
         family: 4 // Force IPv4 to prevent Node.js 22 IPv6 timeouts
      });
      console.log('MongoDB connected successfully');
   } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
   }
};

export default connectDB;