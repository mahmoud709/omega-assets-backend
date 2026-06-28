import { Response } from 'express';
import Asset from '../models/Asset';
import CustodyLog from '../models/CustodyLog';
import MaintenanceTask from '../models/MaintenanceTask';
import { AuthRequest } from '../middleware/auth';

export const getInventoryByProject = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId } = req.params;

      const assets = await Asset.find({ projectId, isActive: true })
         .populate('categoryId', 'name path')
         .populate('currentCustodianId', 'fullName email')
         .sort({ categoryId: 1, name: 1 });

      const grouped: any = {};
      assets.forEach((asset) => {
         const categoryName = (asset.categoryId as any)?.path || 'Uncategorized';
         if (!grouped[categoryName]) {
            grouped[categoryName] = [];
         }
         grouped[categoryName].push(asset);
      });

      const summary = Object.keys(grouped).map((category) => ({
         category,
         count: grouped[category].length,
         assets: grouped[category],
      }));

      res.status(200).json({
         message: 'Inventory by project retrieved',
         projectId,
         totalAssets: assets.length,
         byCategory: summary,
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getFinancialValuation = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, categoryId } = req.query;

      const matchStage: any = { isActive: true };
      if (projectId) matchStage.projectId = projectId;
      if (categoryId) matchStage.categoryId = categoryId;

      const result = await Asset.aggregate([
         { $match: matchStage },
         {
            $group: {
               _id: projectId ? '$categoryId' : '$projectId',
               totalValue: { $sum: '$purchaseCost' },
               assetCount: { $sum: 1 },
            },
         },
         {
            $lookup: {
               from: projectId ? 'categories' : 'projects',
               localField: '_id',
               foreignField: '_id',
               as: 'details',
            },
         },
         { $unwind: { path: '$details', preserveNullAndEmptyArrays: true } },
         {
            $project: {
               _id: 0,
               groupId: '$_id',
               groupName: projectId ? '$details.name' : '$details.name',
               totalValue: 1,
               assetCount: 1,
            },
         },
         { $sort: { totalValue: -1 } },
      ]);

      const grandTotal = result.reduce((sum, item) => sum + (item.totalValue || 0), 0);

      res.status(200).json({
         message: 'Financial valuation retrieved',
         filters: { projectId: projectId || 'all', categoryId: categoryId || 'all' },
         grandTotal,
         byGroup: result,
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const exportInventorySheet = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, format = 'json' } = req.query;

      const filter: Record<string, any> = { isActive: true };
      if (projectId) {
         filter.projectId = projectId as string;
      } else {
         filter.projectId = { $exists: true };
      }

      const assets = await Asset.find(filter)
         .populate('projectId', 'name location')
         .populate('categoryId', 'name path')
         .populate('currentCustodianId', 'fullName email')
         .populate('createdBy', 'fullName')
         .lean();

      const sheet = assets.map((asset: any) => ({
         systemId: asset.systemId,
         name: asset.name,
         serialNumber: asset.serialNumber,
         project: asset.projectId?.name || 'N/A',
         category: asset.categoryId?.path || 'N/A',
         condition: asset.condition,
         purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : 'N/A',
         purchaseCost: asset.purchaseCost || 0,
         vendor: asset.vendor || 'N/A',
         currentCustodian: asset.currentCustodianId?.fullName || 'In Storage',
         custodianEmail: asset.currentCustodianId?.email || 'N/A',
         custodyStartDate: asset.custodyStartDate ? new Date(asset.custodyStartDate).toLocaleDateString() : 'N/A',
         qrCode: asset.qrCodeImage || 'N/A',
         createdBy: asset.createdBy?.fullName || 'N/A',
         createdAt: new Date(asset.createdAt).toLocaleDateString(),
      }));

      if (format === 'csv') {
         const headers = Object.keys(sheet[0] || {});
         const csv = [
            headers.join(','),
            ...sheet.map((row: any) =>
               headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')
            ),
         ].join('\n');

         res.setHeader('Content-Type', 'text/csv');
         res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
         res.send(csv);
      } else {
         res.status(200).json({
            message: 'Inventory sheet exported',
            totalAssets: sheet.length,
            data: sheet,
         });
      }
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
   try {
      const matchStage: any = { isActive: true };
      if (req.user!.role !== 'admin' && req.user!.siteId) {
         matchStage.projectId = req.user!.siteId;
      }

      const conditionStats = await Asset.aggregate([
         { $match: matchStage },
         { $group: { _id: '$condition', count: { $sum: 1 } } }
      ]);

      const data = {
         excellent: 0,
         good: 0,
         needs_repair: 0,
         scrapped: 0,
      };

      conditionStats.forEach(stat => {
         if (stat._id in data) {
            data[stat._id as keyof typeof data] = stat.count;
         }
      });

      res.status(200).json({ message: 'Dashboard stats retrieved', data });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getMaintenanceStats = async (req: AuthRequest, res: Response) => {
   try {
      const matchAsset: any = {};
      if (req.user!.role !== 'admin' && req.user!.siteId) {
         matchAsset['asset.projectId'] = req.user!.siteId;
      }

      const mostBroken = await MaintenanceTask.aggregate([
         {
            $lookup: {
               from: 'assets',
               localField: 'assetId',
               foreignField: '_id',
               as: 'asset'
            }
         },
         { $unwind: '$asset' },
         { $match: matchAsset },
         {
            $group: {
               _id: '$assetId',
               assetName: { $first: '$asset.name' },
               systemId: { $first: '$asset.systemId' },
               taskCount: { $sum: 1 },
               totalCost: { $sum: { $ifNull: ['$cost', 0] } }
            }
         },
         { $sort: { taskCount: -1, totalCost: -1 } },
         { $limit: 10 }
      ]);

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const monthlyCostPipeline: any[] = [
         { $match: { completedDate: { $gte: firstDayOfMonth }, status: 'completed' } },
         {
            $lookup: {
               from: 'assets',
               localField: 'assetId',
               foreignField: '_id',
               as: 'asset'
            }
         },
         { $unwind: '$asset' },
         { $match: matchAsset },
         {
            $group: {
               _id: null,
               totalCost: { $sum: { $ifNull: ['$cost', 0] } }
            }
         }
      ];
      
      const costResult = await MaintenanceTask.aggregate(monthlyCostPipeline);
      const monthlyCost = costResult.length > 0 ? costResult[0].totalCost : 0;

      res.status(200).json({ message: 'Maintenance stats retrieved', data: { mostBroken, monthlyCost } });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};
