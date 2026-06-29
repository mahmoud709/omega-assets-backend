import app from './app';
import dotenv from 'dotenv';
import { initializeScheduler } from './services/scheduler';
import User from './models/User';
import bcrypt from 'bcrypt';

dotenv.config();

const PORT = process.env.PORT || 5000;

const createDefaultAdmin = async () => {
   try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('admin123', salt);
      
      let adminUser = await User.findOne({ email: 'admin@admin.com' });
      
      if (adminUser) {
         adminUser.passwordHash = passwordHash;
         if (adminUser.role !== 'admin') {
            adminUser.role = 'admin';
         }
         await adminUser.save();
         console.log('User admin@admin.com password reset to admin123');
         return;
      }

      await User.create({
         email: 'admin@admin.com',
         passwordHash,
         fullName: 'مدير النظام',
         role: 'admin'
      });
      console.log('Default admin user created: admin@admin.com / admin123');
   } catch (error) {
      console.error('Error creating default admin:', error);
   }
};

const server = app.listen(PORT as number, '0.0.0.0', async () => {
   console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode, bound to 0.0.0.0`);
   await createDefaultAdmin();
});

initializeScheduler();

process.on('SIGTERM', () => {
   console.log('SIGTERM received, shutting down gracefully');
   server.close(() => {
      console.log('Server closed');
      process.exit(0);
   });
});