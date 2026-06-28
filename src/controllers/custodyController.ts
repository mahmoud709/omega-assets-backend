import { Response } from 'express';
import Asset from '../models/Asset';
import CustodyLog from '../models/CustodyLog';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

export const transferCustody = async (req: AuthRequest, res: Response) => {
   const session = await mongoose.startSession();
   session.startTransaction();

   try {
      const { assetId, toUserName, toProjectId, notes } = req.body;

      const asset = await Asset.findById(assetId).session(session);
      if (!asset) {
         await session.abortTransaction();
         return res.status(404).json({ message: 'Asset not found' });
      }

      const previousCustodianId = asset.currentCustodianId;
      const previousCustodianName = asset.custodianName;
      const previousProjectId = asset.projectId;

      const log = new CustodyLog({
         assetId,
         fromProjectId: previousProjectId,
         toProjectId: toProjectId || previousProjectId,
         fromUserId: previousCustodianId,
         fromUserName: previousCustodianName || (previousCustodianId ? undefined : 'المخزن'),
         toUserName,
         transferredAt: new Date(),
         notes,
      });
      await log.save({ session });

      asset.currentCustodianId = undefined;
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
      
      if (assetId) {
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