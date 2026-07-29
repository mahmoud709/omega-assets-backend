import app from './app';
import dotenv from 'dotenv';
import { initializeScheduler } from './services/scheduler';
import User from './models/User';
import bcrypt from 'bcrypt';
import connectDB from './config/database';

dotenv.config();

const PORT = process.env.PORT || 3000;

const createDefaultAdmin = async () => {
   try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('admin123', salt);
      
      // 1. Fetch and log all users in the database so you can find the email
      const allUsers = await User.find({});
      console.log('=== DATABASE USERS ===');
      allUsers.forEach(u => {
         console.log(`- Email: ${u.email} | Name: ${u.fullName} | Role: ${u.role}`);
      });
      console.log('======================');


      // 3. Ensure at least the default admin@admin.com exists
      const hasDefaultAdmin = allUsers.some(u => u.email === 'admin@admin.com');
      if (!hasDefaultAdmin) {
         await User.create({
            email: 'admin@admin.com',
            passwordHash,
            fullName: 'مدير النظام',
            role: 'admin'
         });
         console.log('Default admin user created: admin@admin.com / admin123');
      }
   } catch (error) {
      console.error('Error creating default admin:', error);
   }
};

const startServer = async () => {
   try {
      const server = app.listen(PORT as number, '0.0.0.0', async () => {
         console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode, bound to 0.0.0.0`);
         
         // Connect to Database AFTER opening the port so Airoapp health checks pass instantly!
         await connectDB();
         
         await createDefaultAdmin();
      });

      // Handle unhandled promise rejections
      process.on('unhandledRejection', (err: Error) => {
         console.log(`Error: ${err.message}`);
         // Close server & exit process
         server.close(() => process.exit(1));
      });

      initializeScheduler();

      process.on('SIGTERM', () => {
         console.log('SIGTERM received, shutting down gracefully');
         server.close(() => {
            console.log('Server closed');
            process.exit(0);
         });
      });
   } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
   }
};

startServer();
// Reload server: updated asset reorder to findByIdAndUpdate Promise.all