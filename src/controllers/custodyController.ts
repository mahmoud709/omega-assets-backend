import { Response } from 'express';
import Asset from '../models/Asset';
import CustodyLog from '../models/CustodyLog';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import Employee from '../models/Employee';

export const transferCustody = async (req: AuthRequest, res: Response) => {
   const session = await mongoose.startSession();
   session.startTransaction();

   try {
      const { assetId, toUserName, toProjectId, notes, transferQuantity } = req.body;

      const asset = await Asset.findById(assetId).session(session);
      if (!asset) {
         await session.abortTransaction();
         return res.status(404).json({ message: 'Asset not found' });
      }

      const previousCustodianId = asset.currentCustodianId;
      const previousCustodianName = asset.custodianName;
      const previousProjectId = asset.projectId;

      const requestedQty = parseInt(transferQuantity, 10);

      // Find the Employee (or Office) ID by name and project
      let targetCustodianId: mongoose.Types.ObjectId | undefined = undefined;
      if (toUserName && toUserName !== 'المخزن') {
         const emp = await Employee.findOne({ name: toUserName, projectId: toProjectId || previousProjectId });
         if (emp) {
            targetCustodianId = emp._id as mongoose.Types.ObjectId;
         }
      }

      if (requestedQty > 0 && requestedQty < (asset.quantity || 1)) {
         // Split transfer!
         const originalQty = asset.quantity || 1;
         
         // Reduce the original asset quantity
         asset.quantity = originalQty - requestedQty;
         await asset.save({ session });

         // Create a new split asset
         const count = await Asset.countDocuments().session(session);
         const systemId = `OMEGA-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
         const qrData = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assets/${systemId}`;

         const newAsset = new Asset({
            systemId,
            projectId: toProjectId || previousProjectId,
            categoryId: asset.categoryId,
            name: asset.name,
            quantity: requestedQty,
            serialNumber: asset.serialNumber ? `${asset.serialNumber}-split` : undefined,
            condition: asset.condition || 'good',
            notes: asset.notes,
            specifications: asset.specifications || {},
            qrCodeData: qrData,
            currentCustodianId: targetCustodianId,
            custodianName: toUserName,
            custodyStartDate: new Date(),
            isActive: true,
            createdBy: req.user!._id,
         });

         await newAsset.save({ session });

         // Save custody log for the split
         const log = new CustodyLog({
            assetId: newAsset._id,
            fromProjectId: previousProjectId,
            toProjectId: toProjectId || previousProjectId,
            fromUserId: previousCustodianId,
            fromUserName: previousCustodianName || (previousCustodianId ? undefined : 'المخزن'),
            toUserId: targetCustodianId,
            toUserName,
            transferredAt: new Date(),
            notes: notes || `تجزئة وتسليم عدد ${requestedQty} من الأصل الأصلي (${asset.systemId})`,
         });
         await log.save({ session });

         await session.commitTransaction();
         session.endSession();

         return res.status(200).json({ message: 'Custody split and transferred successfully', log, newAsset });
      }

      // Normal full custody transfer
      const log = new CustodyLog({
         assetId,
         fromProjectId: previousProjectId,
         toProjectId: toProjectId || previousProjectId,
         fromUserId: previousCustodianId,
         fromUserName: previousCustodianName || (previousCustodianId ? undefined : 'المخزن'),
         toUserId: targetCustodianId,
         toUserName,
         transferredAt: new Date(),
         notes,
      });
      await log.save({ session });

      asset.currentCustodianId = targetCustodianId;
      asset.custodianName = toUserName;
      if (toProjectId) {
         asset.projectId = toProjectId;
      }
      asset.custodyStartDate = new Date();
      await asset.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: 'Custody transferred successfully', log });
   } catch (error) {
      await session.abortTransaction();
      session.endSession();
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getCustodyHistory = async (req: AuthRequest, res: Response) => {
   try {
      const { page = 1, limit = 20 } = req.query;
      const { assetId } = req.params;

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, parseInt(limit as string) || 20);
      const skip = (pageNum - 1) * limitNum;

      const filter: Record<string, any> = {};
      
      if (assetId && assetId !== 'all') {
         let actualAssetId = assetId;
         if (!/^[0-9a-fA-F]{24}$/.test(assetId)) {
            const asset = await Asset.findOne({ systemId: assetId });
            if (asset) actualAssetId = asset._id.toString();
         }
         filter.assetId = actualAssetId;
      }

      const logs = await CustodyLog.find(filter)
         .populate('fromProjectId', 'name')
         .populate('toProjectId', 'name')
         .populate('fromUserId', 'fullName email')
         .populate('toUserId', 'fullName email')
         .populate('assetId', 'name systemId')
         .skip(skip)
         .limit(limitNum)
         .sort({ transferredAt: -1 });

      const total = await CustodyLog.countDocuments(filter);

      res.status(200).json({
         message: 'Custody history retrieved',
         data: logs,
         pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getCurrentCustodian = async (req: AuthRequest, res: Response) => {
   try {
      const { assetId } = req.params;

      const asset = await Asset.findById(assetId).populate('currentCustodianId', 'fullName email role');

      if (!asset) {
         return res.status(404).json({ message: 'Asset not found' });
      }

      res.status(200).json({
         message: 'Current custodian retrieved',
         custodian: asset.currentCustodianId,
         custodyStartDate: asset.custodyStartDate,
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const returnCustody = async (req: AuthRequest, res: Response) => {
   try {
      const { assetId } = req.params;
      const { notes } = req.body;

      const asset = await Asset.findById(assetId);
      if (!asset) {
         return res.status(404).json({ message: 'Asset not found' });
      }

      if (asset.currentCustodianId) {
         const log = new CustodyLog({
            assetId,
            fromUserId: asset.currentCustodianId,
            toUserId: req.user!._id,
            notes: notes || 'Asset returned to store',
         });
         await log.save();
      }

      asset.currentCustodianId = undefined;
      asset.custodyStartDate = undefined;
      await asset.save();

      res.status(200).json({ message: 'Asset returned successfully', asset });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const withdrawCustody = async (req: AuthRequest, res: Response) => {
   const session = await mongoose.startSession();
   session.startTransaction();

   try {
      const { assetId } = req.params;
      const { quantity, reason } = req.body;

      const asset = await Asset.findById(assetId).session(session);
      if (!asset) {
         await session.abortTransaction();
         session.endSession();
         return res.status(404).json({ message: 'Asset not found' });
      }

      const requestedQty = parseInt(quantity, 10);
      if (isNaN(requestedQty) || requestedQty <= 0) {
         await session.abortTransaction();
         session.endSession();
         return res.status(400).json({ message: 'الكمية يجب أن تكون أكبر من الصفر' });
      }

      const currentQty = asset.quantity || 1;
      if (requestedQty > currentQty) {
         await session.abortTransaction();
         session.endSession();
         return res.status(400).json({ message: 'الكمية المراد سحبها أكبر من الكمية المتاحة بالأصل' });
      }

      if (!reason || typeof reason !== 'string' || reason.trim() === '') {
         await session.abortTransaction();
         session.endSession();
         return res.status(400).json({ message: 'سبب السحب إجباري' });
      }

      // Reduce quantity
      asset.quantity = currentQty - requestedQty;
      if (asset.quantity === 0) {
         asset.isActive = false;
      }
      await asset.save({ session });

      // Save log
      const log = new CustodyLog({
         assetId: asset._id,
         fromProjectId: asset.projectId,
         fromUserId: asset.currentCustodianId,
         fromUserName: asset.custodianName || (asset.currentCustodianId ? undefined : 'المخزن'),
         toUserId: req.user!._id,
         toUserName: 'سحب واستهلاك',
         transferredAt: new Date(),
         notes: `سحب عدد ${requestedQty}. السبب: ${reason.trim()}`,
      });
      await log.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: 'Asset quantity withdrawn successfully', asset, log });
   } catch (error) {
      await session.abortTransaction();
      session.endSession();
      res.status(500).json({ message: 'Server error', error });
   }
};

export const bulkTransferCustody = async (req: AuthRequest, res: Response) => {
   const session = await mongoose.startSession();
   session.startTransaction();

   try {
      const { assetIds, toProjectId, toUserName, toUserId, notes } = req.body;

      if (!Array.isArray(assetIds) || assetIds.length === 0) {
         await session.abortTransaction();
         session.endSession();
         return res.status(400).json({ message: 'لم يتم تحديد أصول للنقل' });
      }

      let targetCustodianId: mongoose.Types.ObjectId | undefined = undefined;
      if (toUserId && mongoose.Types.ObjectId.isValid(toUserId)) {
         targetCustodianId = new mongoose.Types.ObjectId(toUserId);
      } else if (toUserName && toUserName !== 'المخزن') {
         const emp = await Employee.findOne({ name: toUserName });
         if (emp) {
            targetCustodianId = emp._id as mongoose.Types.ObjectId;
         }
      }

      const query: any = { _id: { $in: assetIds }, isActive: true };
      if (req.user!.role !== 'admin' && req.user!.siteId) {
         query.projectId = req.user!.siteId;
      }

      const assets = await Asset.find(query).session(session);

      const logsToInsert: any[] = [];
      let updatedCount = 0;

      for (const asset of assets) {
         const previousCustodianId = asset.currentCustodianId;
         const previousCustodianName = asset.custodianName;
         const previousProjectId = asset.projectId;

         logsToInsert.push({
            assetId: asset._id,
            fromProjectId: previousProjectId,
            toProjectId: toProjectId || previousProjectId,
            fromUserId: previousCustodianId,
            fromUserName: previousCustodianName || (previousCustodianId ? undefined : 'المخزن'),
            toUserId: targetCustodianId,
            toUserName: toUserName !== undefined ? (toUserName || 'المخزن') : (previousCustodianName || 'المخزن'),
            transferredAt: new Date(),
            notes: notes || `نقل جماعي لعدد ${assetIds.length} أصول`,
         });

         if (toProjectId) {
            asset.projectId = toProjectId;
         }
         if (toUserName !== undefined) {
            asset.custodianName = toUserName;
            asset.currentCustodianId = targetCustodianId;
            asset.custodyStartDate = toUserName ? new Date() : undefined;
         }

         await asset.save({ session });
         updatedCount++;
      }

      if (logsToInsert.length > 0) {
         await CustodyLog.insertMany(logsToInsert, { session });
      }

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
         message: `تم نقل ${updatedCount} عنصر جماعياً بنجاح`,
         transferredCount: updatedCount,
      });
   } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Bulk transfer error:', error);
      res.status(500).json({ message: 'Server error', error });
   }
};