import app from './app';
import dotenv from 'dotenv';
import { initializeScheduler } from './services/scheduler';
import User from './models/User';
import Asset from './models/Asset';
import Category from './models/Category';
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

const migrateTotalStationAssetNames = async () => {
   try {

      const categories = await Category.find({});
      const catMap: Record<string, string> = {};
      categories.forEach(c => { catMap[c._id.toString()] = c.name; });

      const laptops = await Asset.find({
        name: { $regex: /لاب|laptop|macbook|zbook|thinkpad|elitebook|latitude|precision|notebook|نوت\s*بوك/i }
      });

      let totalQty = 0;
      laptops.forEach(a => {
        const q = (a as any).quantity || 1;
        totalQty += q;
      });
      // 1. Rename all laptop categories to "أجهزة لابتوب"
      await Category.updateMany(
        { name: { $regex: /لاب|laptop/i } },
        { $set: { name: 'أجهزة لابتوب' } }
      );

      // 2. Fetch fresh categories
      const freshCategories = await Category.find({});

      // 3. For each project, ensure there's at most ONE "أجهزة لابتوب" Category and reassign assets if needed
      const projectIds = Array.from(new Set(freshCategories.map(c => c.projectId?.toString()).filter(Boolean)));
      for (const pId of projectIds) {
        const pLaps = freshCategories.filter(c => c.projectId?.toString() === pId && c.name === 'أجهزة لابتوب');
        if (pLaps.length > 1) {
          const primaryCat = pLaps[0];
          const duplicateCatIds = pLaps.slice(1).map(c => c._id);
          // Reassign assets from duplicates to primary
          await Asset.updateMany(
            { categoryId: { $in: duplicateCatIds } },
            { $set: { categoryId: primaryCat._id } }
          );
          // Delete duplicate categories
          await Category.deleteMany({ _id: { $in: duplicateCatIds } });
          console.log(`[Migration] Cleaned up ${duplicateCatIds.length} duplicate 'أجهزة لابتوب' categories in project ${pId}`);
        }
      }

      // 4. Ensure ALL laptop assets belong to an "أجهزة لابتوب" Category
      const laptopAssets = await Asset.find({
        name: { $regex: /لاب|laptop|macbook|zbook|thinkpad|elitebook|latitude|precision|notebook|نوت\s*بوك/i }
      });

      for (const lap of laptopAssets) {
        let laptopCategory = await Category.findOne({ 
          projectId: lap.projectId, 
          name: 'أجهزة لابتوب' 
        });
        if (!laptopCategory) {
          laptopCategory = await Category.create({
            projectId: lap.projectId,
            name: 'أجهزة لابتوب',
            level: 1,
            path: '/أجهزة لابتوب'
          });
        }
        await Asset.updateOne({ _id: lap._id }, { $set: { categoryId: laptopCategory._id } });
      }
      console.log(`[Migration] Successfully consolidated ${laptopAssets.length} laptops under 'أجهزة لابتوب' category.`);

      const assets = await Asset.find({ name: { $regex: /توتال|جهاز محطة متكاملة/i } });
      for (const a of assets) {
         if (a.name) {
            let newName = a.name
               .replace(/جهاز محطة متكاملة \(Total Station\)/g, 'أجهزة توتال')
               .replace(/جهاز محطة متكاملة/g, 'أجهزة توتال')
               .replace(/\bتوتال\b/g, 'أجهزة توتال')
               .replace(/أجهزة أجهزة توتال/g, 'أجهزة توتال');
            if (newName !== a.name) {
               await Asset.updateOne({ _id: a._id }, { $set: { name: newName } });
               console.log(`[Migration] Updated asset name: ${a.name} -> ${newName}`);
            }
         }
      }
   } catch (err) {
      console.error('Error migrating asset categories/names:', err);
   }
};

const startServer = async () => {
   try {
      const server = app.listen(PORT as number, '0.0.0.0', async () => {
         console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode, bound to 0.0.0.0`);
         
         // Connect to Database AFTER opening the port so Airoapp health checks pass instantly!
         await connectDB();
         
         await createDefaultAdmin();
         await migrateTotalStationAssetNames();
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