import { Request, Response } from 'express';
import Asset from '../models/Asset';
import CustodyLog from '../models/CustodyLog';
import { AuthRequest } from '../middleware/auth';
import Employee from '../models/Employee';

export const createAsset = async (req: AuthRequest, res: Response) => {
   try {
      const {
         projectId,
         categoryId,
         name,
         quantity,
         serialNumber,
         purchaseDate,
         purchaseCost,
         vendor,
         condition,
         currentCustodianId,
         maintenanceSchedule,
         notes,
      } = req.body;

      const count = await Asset.countDocuments();
      const systemId = `OMEGA-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const qrData = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assets/${systemId}`;

      let finalProjectId = projectId;
      if (req.user!.role !== 'admin' && req.user!.siteId) {
         finalProjectId = req.user!.siteId;
      }

      const asset = new Asset({
         systemId,
         projectId: finalProjectId,
         categoryId,
         name,
         quantity: quantity || 1,
         serialNumber,
         purchaseDate,
         purchaseCost,
         vendor,
         condition: condition || 'good',
         notes,
         specifications: specifications || {},
         qrCodeData: qrData,
         qrCodeImage: undefined, // Opting not to save images on server
         currentCustodianId,
         custodyStartDate: currentCustodianId ? new Date() : undefined,
         maintenanceSchedule,
         isActive: true,
         createdBy: req.user!._id,
      });

      await asset.save();

      res.status(201).json({ message: 'Asset created', asset });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getAssets = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, categoryId, custodianId, search, condition, assignment, ids, page = 1, limit = 20 } = req.query;
      const query: any = { isActive: true };

      if (ids) {
         const idsArray = (ids as string).split(',');
         query._id = { $in: idsArray };
      }

      if (projectId) query.projectId = projectId;
      if (categoryId) query.categoryId = categoryId;
      if (custodianId) {
         const employee = await Employee.findById(custodianId);
         if (employee) {
            query.$or = [
               { currentCustodianId: custodianId },
               { custodianName: employee.name }
            ];
         } else {
            query.currentCustodianId = custodianId;
         }
      }
      if (condition) query.condition = condition;
      
      if (assignment === 'stock') {
         query.$and = [
            { currentCustodianId: null },
            { $or: [{ custodianName: null }, { custodianName: '' }] }
         ];
      } else if (assignment === 'custody') {
         query.$or = [
            { currentCustodianId: { $ne: null } },
            { custodianName: { $nin: [null, ''] } }
         ];
      }
      if (search) {
         query.$or = [
            { systemId: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
         ];
      }

      // Role-based filtering: strict project isolation
      if (req.user!.role !== 'admin') {
         if (req.user!.siteId) {
            query.projectId = req.user!.siteId;
         } else {
            // If user is not admin and has no assigned project, they see nothing
            return res.status(200).json({ message: 'Assets retrieved', data: [], pagination: { total: 0, pages: 0, page: 1, limit: 20 } });
         }
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(10000, parseInt(limit as string) || 20);
      const skip = (pageNum - 1) * limitNum;

      const assets = await Asset.find(query)
         .populate('projectId', 'name location')
         .populate('categoryId', 'name path')
         .populate('currentCustodianId', 'fullName email')
         .populate('createdBy', 'fullName')
         .skip(skip)
         .limit(limitNum)
         .sort({ createdAt: -1 });

      const total = await Asset.countDocuments(query);

      res.status(200).json({
         message: 'Assets retrieved',
         data: assets,
         pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getAssetById = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;

      const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
      const query = isObjectId ? { _id: id } : { systemId: id };

      const asset = await Asset.findOne(query)
         .populate('projectId', 'name location')
         .populate('categoryId', 'name path')
         .populate('currentCustodianId', 'fullName email role')
         .populate('createdBy', 'fullName email');

      if (!asset) {
         return res.status(404).json({ message: 'Asset not found' });
      }

      res.status(200).json({ message: 'Asset retrieved', asset });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const updateAsset = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const { 
         name, condition, specifications, maintenanceSchedule, currentCustodianId,
         serialNumber, purchaseDate, purchaseCost, vendor, notes, custodianName
      } = req.body;

      const asset = await Asset.findById(id);
      if (!asset) {
         return res.status(404).json({ message: 'Asset not found' });
      }

      if (name !== undefined) asset.name = name;
      if (condition !== undefined) asset.condition = condition;
      if (specifications !== undefined) asset.specifications = specifications;
      if (maintenanceSchedule !== undefined) asset.maintenanceSchedule = maintenanceSchedule;
      if (serialNumber !== undefined) asset.serialNumber = serialNumber;
      if (purchaseDate !== undefined) asset.purchaseDate = purchaseDate;
      if (purchaseCost !== undefined) asset.purchaseCost = purchaseCost;
      if (vendor !== undefined) asset.vendor = vendor;
      if (notes !== undefined) asset.notes = notes;

      if (custodianName !== undefined && asset.custodianName !== custodianName) {
         const prevCustodianName = asset.custodianName;
         asset.custodianName = custodianName;
         asset.custodyStartDate = new Date();

         const log = new CustodyLog({
            assetId: asset._id,
            fromUserName: prevCustodianName || 'المخزن',
            toUserName: custodianName || 'المخزن',
            notes: 'تم تغيير العهدة من خلال التعديل المباشر',
         });
         await log.save();
      }

      if (currentCustodianId && asset.currentCustodianId?.toString() !== currentCustodianId) {
         const prevCustodian = asset.currentCustodianId;
         asset.currentCustodianId = currentCustodianId;
         asset.custodyStartDate = new Date();

         if (prevCustodian) {
            const log = new CustodyLog({
               assetId: asset._id,
               fromUserId: prevCustodian,
               toUserId: currentCustodianId,
               notes: 'Custodian changed via asset update',
            });
            await log.save();
         }
      }

      await asset.save();

      res.status(200).json({ message: 'Asset updated', asset });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const deleteAsset = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;

      const asset = await Asset.findById(id);
      if (!asset) {
         return res.status(404).json({ message: 'Asset not found' });
      }

      asset.isActive = false;
      await asset.save();

      res.status(200).json({ message: 'Asset soft-deleted' });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const assignCustodian = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const { custodianName, notes } = req.body;

      const asset = await Asset.findById(id);
      if (!asset) {
         return res.status(404).json({ message: 'Asset not found' });
      }

      const prevCustodianId = asset.currentCustodianId;
      const prevCustodianName = asset.custodianName;
      
      asset.currentCustodianId = undefined;
      asset.custodianName = custodianName;
      asset.custodyStartDate = new Date();
      await asset.save();

      const log = new CustodyLog({
         assetId: asset._id,
         fromUserId: prevCustodianId,
         fromUserName: prevCustodianName || (prevCustodianId ? undefined : 'المخزن'),
         toUserName: custodianName,
         notes: notes || 'تم نقل العهدة',
      });
      await log.save();

      res.status(200).json({ message: 'Custodian assigned', asset });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const bulkCreateAssets = async (req: AuthRequest, res: Response) => {
   try {
      const { assets } = req.body;
      if (!Array.isArray(assets) || assets.length === 0) {
         return res.status(400).json({ message: 'No assets provided' });
      }

      const userSiteId = req.user!.role !== 'admin' ? req.user!.siteId : null;
      let count = await Asset.countDocuments();
      
      const createdAssets = [];
      const currentYear = new Date().getFullYear();
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      for (const assetData of assets) {
         // Prevent assigning to a different project if restricted
         if (userSiteId && assetData.projectId !== userSiteId.toString()) {
            continue;
         }

         count++;
         const systemId = `OMEGA-${currentYear}-${String(count).padStart(4, '0')}`;
         const qrData = `${frontendUrl}/assets/${systemId}`;
         // Optimization: Do NOT generate QR code image files on disk during bulk import to prevent timeouts.
         // They can be generated on-the-fly or added later if needed.

         createdAssets.push(new Asset({
            systemId,
            projectId: assetData.projectId,
            categoryId: assetData.categoryId,
            name: assetData.name,
            quantity: assetData.quantity || 1,
            serialNumber: assetData.serialNumber,
            purchaseDate: assetData.purchaseDate,
            purchaseCost: assetData.purchaseCost,
            vendor: assetData.vendor,
            condition: assetData.condition || 'good',
            notes: assetData.notes,
            specifications: assetData.specifications || {},
            qrCodeData: qrData,
            qrCodeImage: undefined, // Optional in schema
            custodianName: assetData.custodianName,
            isActive: true,
            createdBy: req.user!._id,
         }));
      }

      // Batch insert for performance
      const batchSize = 5000;
      for (let i = 0; i < createdAssets.length; i += batchSize) {
         const batch = createdAssets.slice(i, i + batchSize);
         await Asset.insertMany(batch);
      }

      res.status(201).json({ message: `${createdAssets.length} assets successfully imported` });
   } catch (error) {
      console.error('Bulk import error:', error);
      res.status(500).json({ message: 'Server error', error });
   }
};