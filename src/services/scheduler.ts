// @ts-ignore
import cron from 'node-cron';
import MaintenanceTask from '../models/MaintenanceTask';
import Asset from '../models/Asset';
import Notification from '../models/Notification';
import User from '../models/User';

export const initializeScheduler = () => {
   console.log('Scheduler initialized');

   cron.schedule('0 8 * * *', async () => {
      try {
         console.log('Running scheduled maintenance check...');
         await checkDueMaintenance();
         await checkCustodyExpiry();
      } catch (error) {
         console.error('Scheduler error:', error);
      }
   });
};

const checkDueMaintenance = async () => {
   try {
      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const tasks = await MaintenanceTask.find({
         scheduledDate: {
            $gte: now,
            $lte: threeDaysLater,
         },
         status: 'pending',
      }).populate('assetId');

      for (const task of tasks) {
         const asset = task.assetId as any;
         if (asset && asset.currentCustodianId) {
            const notification = new Notification({
               userId: asset.currentCustodianId,
               type: 'maintenance_due',
               message: `Maintenance due soon for asset: ${asset.name} (${asset.systemId}). Scheduled for ${new Date(task.scheduledDate).toLocaleDateString()}`,
               link: `/assets/${asset._id}`,
            });
            await notification.save();
            console.log(`Maintenance notification created for asset ${asset.systemId}`);
         }

         const admins = await User.find({ role: 'admin' });
         for (const admin of admins) {
            const notification = new Notification({
               userId: admin._id,
               type: 'maintenance_due',
               message: `Maintenance due soon for asset: ${asset.name} (${asset.systemId}). Scheduled for ${new Date(task.scheduledDate).toLocaleDateString()}`,
               link: `/assets/${asset._id}`,
            });
            await notification.save();
         }
      }
   } catch (error) {
      console.error('Error checking due maintenance:', error);
   }
};

const checkCustodyExpiry = async () => {
   try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const assets = await Asset.find({
         currentCustodianId: { $exists: true, $ne: null },
         custodyStartDate: {
            $lte: thirtyDaysAgo,
         },
         isActive: true,
      }).populate('currentCustodianId');

      for (const asset of assets) {
         const custodian = asset.currentCustodianId as any;
         if (custodian) {
            const notification = new Notification({
               userId: custodian._id,
               type: 'custody_expiry',
               message: `Asset custody period exceeded 30 days: ${asset.name} (${asset.systemId}). Please return or renew custody.`,
               link: `/assets/${asset._id}`,
            });
            await notification.save();
            console.log(`Custody expiry notification created for ${custodian.fullName}`);
         }

         const admins = await User.find({ role: 'admin' });
         for (const admin of admins) {
            const notification = new Notification({
               userId: admin._id,
               type: 'custody_expiry',
               message: `Asset custody period exceeded 30 days: ${asset.name} (${asset.systemId}) held by ${custodian?.fullName}. Please review.`,
               link: `/assets/${asset._id}`,
            });
            await notification.save();
         }
      }
   } catch (error) {
      console.error('Error checking custody expiry:', error);
   }
};

export const getScheduledJobs = () => {
   return cron.getTasks();
};
