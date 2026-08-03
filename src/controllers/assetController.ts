import { Request, Response } from 'express';
import Asset from '../models/Asset';
import CustodyLog from '../models/CustodyLog';
import { AuthRequest } from '../middleware/auth';
import Employee from '../models/Employee';
import mongoose from 'mongoose';

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
         specifications,
         image,
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
         quantity: quantity !== undefined && quantity !== null && quantity !== '' ? Number(quantity) : 1,
         serialNumber,
         purchaseDate,
         purchaseCost,
         vendor,
         condition: condition || 'good',
         notes,
         specifications: specifications || {},
         qrCodeData: qrData,
         qrCodeImage: undefined, // Opting not to save images on server
         image,
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

const buildArabicRegexPattern = (searchTerm: string) => {
   if (!searchTerm || typeof searchTerm !== 'string') return null;
   let term = searchTerm.trim();
   if (!term) return null;

   const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
   term = term.replace(/[٠-٩]/g, (w) => String(arabicNumbers.indexOf(w)));

   let pattern = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
   pattern = pattern.replace(/[\u064B-\u0652]/g, '');

   pattern = pattern
      .replace(/[أإآا]/g, '[أإآا]')
      .replace(/[ةه]/g, '[ةه]')
      .replace(/[ىي]/g, '[ىي]');

   return new RegExp(pattern, 'i');
};

export const getAssets = async (req: AuthRequest, res: Response) => {
   try {
      // ONE-TIME CLEANUP: Remove "حصر دفتري" from notes
      const assetsWithNotes = await Asset.find({ notes: { $regex: 'حصر دفتري' } });
      for (const a of assetsWithNotes) {
         if (a.notes) {
            a.notes = a.notes.replace(/حصر دفتري/g, '').trim();
            await a.save();
         }
      }

      const { projectId, categoryId, custodianId, search, condition, assignment, ids, page = 1, limit = 20 } = req.query;
      const query: any = { isActive: true };

      if (ids) {
         const idsArray = (ids as string).split(',');
         query._id = { $in: idsArray };
      }

      if (projectId) {
         const pIds = (projectId as string).split(',');
         if (pIds.length > 1) {
            query.projectId = { $in: pIds };
         } else {
            query.projectId = projectId;
         }
      }
      if (categoryId) {
         const cIds = (categoryId as string).split(',');
         if (cIds.length > 1) {
            query.categoryId = { $in: cIds };
         } else {
            query.categoryId = categoryId;
         }
      }
      if (custodianId) {
         const employee = await Employee.findById(custodianId);
         if (employee) {
            // Self-healing: Associate any assets matching this employee's name that lack currentCustodianId
            await Asset.updateMany(
               { custodianName: employee.name, currentCustodianId: null },
               { $set: { currentCustodianId: employee._id } }
            );

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
         const searchRegex = buildArabicRegexPattern(search as string);
         if (searchRegex) {
            const searchOr = [
               { systemId: { $regex: searchRegex } },
               { name: { $regex: searchRegex } },
               { serialNumber: { $regex: searchRegex } },
               { custodianName: { $regex: searchRegex } },
               { notes: { $regex: searchRegex } },
               { vendor: { $regex: searchRegex } },
            ];

            if (query.$or) {
               query.$and = query.$and || [];
               query.$and.push({ $or: searchOr });
            } else {
               query.$or = searchOr;
            }
         }
      }

      // Role-based filtering: strict project isolation
      if (req.user && req.user.role !== 'admin') {
         if (req.user.siteId) {
            query.projectId = req.user.siteId;
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
         .sort({ sortOrder: 1, createdAt: -1 });

      const total = await Asset.countDocuments(query);
      const allMatchingAssets = await Asset.find(query).select('quantity');
      const totalQuantity = allMatchingAssets.reduce((sum, asset) => sum + (asset.quantity || 1), 0);

      res.status(200).json({
         message: 'Assets retrieved',
         data: assets,
         pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum), totalQuantity },
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
         serialNumber, purchaseDate, purchaseCost, vendor, notes, custodianName, image, quantity, categoryId
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
      if (image !== undefined) asset.image = image;
      if (quantity !== undefined) asset.quantity = Number(quantity);
      if (categoryId !== undefined) asset.categoryId = categoryId;

      if (custodianName !== undefined && asset.custodianName !== custodianName) {
         const prevCustodianName = asset.custodianName;
         asset.custodianName = custodianName;
         asset.currentCustodianId = undefined; // Clear the old User ref so it prioritizes Employee name
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

      // Resolve employee names to employee IDs
      const employeeNames = assets
         .map((a: any) => a.custodianName)
         .filter((name: any): name is string => typeof name === 'string' && name.trim() !== '');

      const matchedEmployees = await Employee.find({ name: { $in: employeeNames }, isActive: true });
      const employeeMap = new Map<string, string>();
      matchedEmployees.forEach(emp => {
         employeeMap.set(emp.name.trim().toLowerCase(), emp._id.toString());
      });

      for (const assetData of assets) {
         // Prevent assigning to a different project if restricted
         if (userSiteId && assetData.projectId !== userSiteId.toString()) {
            continue;
         }

         let currentCustodianId: string | undefined = undefined;
         if (assetData.custodianName) {
            currentCustodianId = employeeMap.get(assetData.custodianName.trim().toLowerCase());
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
            quantity: assetData.quantity !== undefined && assetData.quantity !== null && assetData.quantity !== '' ? Number(assetData.quantity) : 1,
            serialNumber: assetData.serialNumber,
            purchaseDate: assetData.purchaseDate,
            purchaseCost: assetData.purchaseCost,
            vendor: assetData.vendor,
            condition: assetData.condition || 'good',
            notes: assetData.notes,
            specifications: assetData.specifications || {},
            qrCodeData: qrData,
            qrCodeImage: undefined, // Optional in schema
            image: assetData.image,
            custodianName: assetData.custodianName,
            currentCustodianId: currentCustodianId || undefined,
            custodyStartDate: currentCustodianId ? new Date() : undefined,
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

export const bulkDeleteAssets = async (req: AuthRequest, res: Response) => {
   try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
         return res.status(400).json({ message: 'لم يتم تحديد عناصر للحذف' });
      }

      const query: any = { _id: { $in: ids } };

      if (req.user!.role !== 'admin' && req.user!.siteId) {
         query.projectId = req.user!.siteId;
      }

      const result = await Asset.updateMany(query, { $set: { isActive: false } });

      res.status(200).json({
         message: `تم حذف ${result.modifiedCount} عنصر بنجاح`,
         deletedCount: result.modifiedCount,
      });
   } catch (error) {
      console.error('Bulk delete error:', error);
      res.status(500).json({ message: 'Server error', error });
   }
};

export const findDuplicateAssets = async (req: AuthRequest, res: Response) => {
   try {
      const matchStage: any = { isActive: true };

      if (req.user!.role !== 'admin' && req.user!.siteId) {
         matchStage.projectId = req.user!.siteId;
      }

      const duplicates = await Asset.aggregate([
         { $match: matchStage },
         {
            $project: {
               name: 1,
               cleanName: { $toLower: { $trim: { input: "$name" } } },
               systemId: 1,
               serialNumber: 1,
               quantity: 1,
               projectId: 1,
               custodianName: 1,
               currentCustodianId: 1,
               condition: 1,
               createdAt: 1,
            }
         },
         {
            $group: {
               _id: "$cleanName",
               originalName: { $first: "$name" },
               count: { $sum: 1 },
               totalQuantity: { $sum: "$quantity" },
               assets: {
                  $push: {
                     _id: "$_id",
                     name: "$name",
                     systemId: "$systemId",
                     serialNumber: "$serialNumber",
                     quantity: "$quantity",
                     projectId: "$projectId",
                     custodianName: "$custodianName",
                     currentCustodianId: "$currentCustodianId",
                     condition: "$condition",
                     createdAt: "$createdAt",
                  }
               }
            }
         },
         { $match: { count: { $gt: 1 } } },
         { $sort: { count: -1 } }
      ]);

      await Asset.populate(duplicates, [
         { path: 'assets.projectId', select: 'name' },
         { path: 'assets.currentCustodianId', select: 'fullName' }
      ]);

      res.status(200).json({
         message: 'تم فحص المتكررات بنجاح',
         totalDuplicateGroups: duplicates.length,
         data: duplicates,
      });
   } catch (error) {
      console.error('Duplicate search error:', error);
      res.status(500).json({ message: 'Server error', error });
   }
};

export const reorderAssets = async (req: AuthRequest, res: Response) => {
   try {
      const { items } = req.body;

      if (!items || !Array.isArray(items)) {
         return res.status(400).json({ message: 'items must be an array' });
      }

      const validIds: string[] = [];
      for (const item of items) {
         const assetId = String(item?.id || item?._id || '');
         if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) continue;
         validIds.push(assetId);
         const idx = items.indexOf(item);
         await Asset.findByIdAndUpdate(assetId, { $set: { sortOrder: idx + 1 } });
      }

      return res.status(200).json({
         message: 'تم حفظ الترتيب بنجاح',
         count: validIds.length,
      });
   } catch (error: any) {
      console.error('[reorderAssets] ERROR:', error?.message, error?.stack);
      return res.status(500).json({
         message: error?.message || 'Unknown error in reorderAssets',
         detail: String(error),
      });
   } 
};

