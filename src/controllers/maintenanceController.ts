import { Request, Response } from 'express';
import MaintenanceTask from '../models/MaintenanceTask';
import Asset from '../models/Asset';
import { AuthRequest } from '../middleware/auth';

export const scheduleMaintenance = async (req: AuthRequest, res: Response) => {
   try {
      const { assetId, scheduledDate, description, cost } = req.body;

      const task = new MaintenanceTask({
         assetId,
         scheduledDate,
         description,
         cost,
         status: 'pending',
      });

      await task.save();

      res.status(201).json({ message: 'Maintenance task scheduled', task });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getMaintenanceTasks = async (req: AuthRequest, res: Response) => {
   try {
      const { assetId, status, startDate, endDate, page = 1, limit = 20 } = req.query;
      const query: any = {};

      if (assetId) query.assetId = assetId;
      if (status) query.status = status;

      if (startDate || endDate) {
         query.scheduledDate = {};
         if (startDate) query.scheduledDate.$gte = new Date(startDate as string);
         if (endDate) query.scheduledDate.$lte = new Date(endDate as string);
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, parseInt(limit as string) || 20);
      const skip = (pageNum - 1) * limitNum;

      const tasks = await MaintenanceTask.find(query)
         .populate('assetId', 'name systemId')
         .populate('performedBy', 'fullName email')
         .skip(skip)
         .limit(limitNum)
         .sort({ scheduledDate: 1 });

      const total = await MaintenanceTask.countDocuments(query);

      res.status(200).json({
         message: 'Maintenance tasks retrieved',
         data: tasks,
         pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const updateMaintenanceStatus = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const { status, cost } = req.body;

      const task = await MaintenanceTask.findById(id);
      if (!task) {
         return res.status(404).json({ message: 'Maintenance task not found' });
      }

      if (status) task.status = status;
      if (cost) task.cost = cost;
      if (status === 'completed') {
         task.completedDate = new Date();
         task.performedBy = req.user!._id;
         
         // Update asset condition to 'good' once maintenance is completed
         await Asset.findByIdAndUpdate(task.assetId, { condition: 'good' });
      } else if (status === 'in_progress' || status === 'pending') {
         // Ensure asset condition is 'needs_repair' when under maintenance
         await Asset.findByIdAndUpdate(task.assetId, { condition: 'needs_repair' });
      }

      await task.save();

      res.status(200).json({ message: 'Maintenance status updated', task });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getDueMaintenance = async (req: AuthRequest, res: Response) => {
   try {
      const now = new Date();
      const tasks = await MaintenanceTask.find({
         scheduledDate: { $lte: now },
         status: 'pending',
      })
         .populate('assetId', 'name systemId projectId')
         .sort({ scheduledDate: 1 });

      res.status(200).json({
         message: 'Due maintenance tasks retrieved',
         data: tasks,
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const reportIssue = async (req: Request, res: Response) => {
   try {
      const { assetId, description } = req.body;

      let actualAssetId = assetId;
      if (!/^[0-9a-fA-F]{24}$/.test(assetId)) {
         const asset = await Asset.findOne({ systemId: assetId });
         if (!asset) return res.status(404).json({ message: 'Asset not found' });
         actualAssetId = asset._id.toString();
      }

      const task = new MaintenanceTask({
         assetId: actualAssetId,
         scheduledDate: new Date(),
         description: `[بلاغ من الـ QR]: ${description}`,
         status: 'pending',
      });

      await task.save();

      // Update asset condition to 'needs_repair'
      await Asset.findByIdAndUpdate(actualAssetId, { condition: 'needs_repair' });

      res.status(201).json({ message: 'Issue reported successfully', task });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};
