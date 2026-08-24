import { Request, Response } from 'express';
import Asset from '../models/Asset';
import CustodyLog from '../models/CustodyLog';
import { AuthRequest } from '../middleware/auth';
import Employee from '../models/Employee';
import Category from '../models/Category';
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
            unit: assetData.unit || assetData.specifications?.unit || 'عدد',
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

export const reconcilePreviewAssets = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, assets } = req.body;
      if (!projectId) {
         return res.status(400).json({ message: 'Project ID is required' });
      }
      if (!Array.isArray(assets) || assets.length === 0) {
         return res.status(400).json({ message: 'No assets provided in file' });
      }

      // Role-based check
      if (req.user!.role !== 'admin' && req.user!.siteId && req.user!.siteId.toString() !== projectId) {
         return res.status(403).json({ message: 'Not authorized for this project' });
      }

      // Fetch all active assets for this project in MongoDB
      const dbAssets = await Asset.find({ projectId, isActive: true })
         .populate('categoryId', 'name')
         .populate('currentCustodianId', 'name');

      // Create lookup maps for fast & smart multi-stage matching
      const systemIdMap = new Map<string, any>();
      const serialMap = new Map<string, any>();
      const nameToDbAssetsMap = new Map<string, any[]>();

      const normalizeText = (str: string): string => {
         if (!str) return '';
         return str
            .toLowerCase()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[\s\-_]+/g, ' ')
            .trim();
      };

      dbAssets.forEach((a: any) => {
         if (a.systemId) systemIdMap.set(a.systemId.trim().toUpperCase(), a);
         if (a.serialNumber && String(a.serialNumber).trim() !== '') {
            serialMap.set(String(a.serialNumber).trim().toUpperCase(), a);
         }
         const normName = normalizeText(a.name);
         if (normName) {
            if (!nameToDbAssetsMap.has(normName)) {
               nameToDbAssetsMap.set(normName, []);
            }
            nameToDbAssetsMap.get(normName)!.push(a);
         }
      });

      const matchedDbAssetIds = new Set<string>();
      const reconciledItems: any[] = [];

      for (let idx = 0; idx < assets.length; idx++) {
         const item = assets[idx];
         let matchedAsset: any = null;

         // 1. Match by System ID
         if (item.systemId && typeof item.systemId === 'string' && item.systemId.trim() !== '') {
            const candidate = systemIdMap.get(item.systemId.trim().toUpperCase());
            if (candidate && !matchedDbAssetIds.has(candidate._id.toString())) {
               matchedAsset = candidate;
            }
         }

         // 2. Match by Serial Number
         if (!matchedAsset && item.serialNumber && String(item.serialNumber).trim() !== '') {
            const candidate = serialMap.get(String(item.serialNumber).trim().toUpperCase());
            if (candidate && !matchedDbAssetIds.has(candidate._id.toString())) {
               matchedAsset = candidate;
            }
         }

         // 3. Match by Smart Normalized Name
         if (!matchedAsset && item.name) {
            const normName = normalizeText(item.name);
            const dbCandidates = nameToDbAssetsMap.get(normName) || [];
            const availableCandidates = dbCandidates.filter(a => !matchedDbAssetIds.has(a._id.toString()));

            if (availableCandidates.length > 0) {
               // 3a. Prefer candidate with matching custodian
               const itemCustNorm = normalizeText(item.custodianName);
               if (itemCustNorm) {
                  matchedAsset = availableCandidates.find(a => normalizeText(a.custodianName) === itemCustNorm);
               }
               // 3b. Fall back to first available candidate with matching name
               if (!matchedAsset) {
                  matchedAsset = availableCandidates[0];
               }
            }
         }

         if (matchedAsset) {
            matchedDbAssetIds.add(matchedAsset._id.toString());
            const changes: any[] = [];

            // Compare fields accurately without false positives
            const newName = (item.name || '').trim();
            const oldName = (matchedAsset.name || '').trim();
            if (newName && normalizeText(newName) !== normalizeText(oldName)) {
               changes.push({ field: 'name', label: 'اسم الأصل', oldValue: oldName, newValue: newName });
            }

            const newQty = Number(item.quantity !== undefined && item.quantity !== null && item.quantity !== '' ? item.quantity : 1);
            const oldQty = Number(matchedAsset.quantity || 1);
            if (newQty !== oldQty) {
               changes.push({ field: 'quantity', label: 'الكمية', oldValue: oldQty, newValue: newQty });
            }

            const newCust = (item.custodianName || '').trim();
            const oldCust = (matchedAsset.custodianName || '').trim();
            if (normalizeText(newCust) !== normalizeText(oldCust)) {
               changes.push({ field: 'custodianName', label: 'اسم العهدة', oldValue: oldCust || 'لا يوجد', newValue: newCust || 'لا يوجد' });
            }

            const newCond = (item.condition || '').trim();
            const oldCond = (matchedAsset.condition || 'good').trim();
            if (newCond && newCond !== oldCond) {
               changes.push({ field: 'condition', label: 'الحالة', oldValue: oldCond, newValue: newCond });
            }

            const newSerial = (item.serialNumber || '').trim();
            const oldSerial = (matchedAsset.serialNumber || '').trim();
            if (newSerial && newSerial !== oldSerial) {
               changes.push({ field: 'serialNumber', label: 'الرقم التسلسلي', oldValue: oldSerial || 'لا يوجد', newValue: newSerial });
            }

            const newNotes = (item.notes || '').trim();
            const oldNotes = (matchedAsset.notes || '').trim();
            if (newNotes && normalizeText(newNotes) !== normalizeText(oldNotes)) {
               changes.push({ field: 'notes', label: 'الملاحظات', oldValue: oldNotes || 'لا يوجد', newValue: newNotes });
            }

            const newVendor = (item.vendor || '').trim();
            const oldVendor = (matchedAsset.vendor || '').trim();
            if (newVendor && normalizeText(newVendor) !== normalizeText(oldVendor)) {
               changes.push({ field: 'vendor', label: 'المورّد', oldValue: oldVendor || 'لا يوجد', newValue: newVendor });
            }

            const status = changes.length > 0 ? 'modified' : 'unchanged';
            reconciledItems.push({
               tempId: `row-${idx}`,
               status,
               matchedAssetId: matchedAsset._id.toString(),
               systemId: matchedAsset.systemId,
               fileData: item,
               dbData: {
                  _id: matchedAsset._id,
                  name: matchedAsset.name,
                  quantity: matchedAsset.quantity,
                  custodianName: matchedAsset.custodianName,
                  condition: matchedAsset.condition,
                  serialNumber: matchedAsset.serialNumber,
                  notes: matchedAsset.notes,
                  vendor: matchedAsset.vendor,
                  categoryName: matchedAsset.categoryId?.name || '',
               },
               changes,
            });
         } else {
            // New asset
            reconciledItems.push({
               tempId: `row-${idx}`,
               status: 'new',
               fileData: item,
               changes: [],
            });
         }
      }

      // Collect assets in DB that were missing from file
      const missingAssets = dbAssets
         .filter((a: any) => !matchedDbAssetIds.has(a._id.toString()))
         .map((a: any) => ({
            assetId: a._id.toString(),
            systemId: a.systemId,
            name: a.name,
            custodianName: a.custodianName,
            quantity: a.quantity || 1,
            condition: a.condition,
            categoryName: a.categoryId?.name || '',
         }));

      const summary = {
         totalInFile: assets.length,
         newCount: reconciledItems.filter(i => i.status === 'new').length,
         modifiedCount: reconciledItems.filter(i => i.status === 'modified').length,
         unchangedCount: reconciledItems.filter(i => i.status === 'unchanged').length,
         missingCount: missingAssets.length,
      };

      res.status(200).json({
         message: 'تم تحليل ومطابقة الملف بنجاح',
         summary,
         items: reconciledItems,
         missingAssets,
      });
   } catch (error) {
      console.error('Reconcile preview error:', error);
      res.status(500).json({ message: 'Server error during reconciliation preview', error });
   }
};

export const reconcileApplyAssets = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, selectedCategoryId, newItems = [], modifiedItems = [], deactivateAssetIds = [] } = req.body;
      if (!projectId) {
         return res.status(400).json({ message: 'Project ID is required' });
      }

      if (req.user!.role !== 'admin' && req.user!.siteId && req.user!.siteId.toString() !== projectId) {
         return res.status(403).json({ message: 'Not authorized for this project' });
      }

      let addedCount = 0;
      let updatedCount = 0;
      let deactivatedCount = 0;

      // 1. Insert new items
      if (Array.isArray(newItems) && newItems.length > 0) {
         let count = await Asset.countDocuments();
         const currentYear = new Date().getFullYear();
         const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

         let fallbackCatId: any = undefined;
         if (selectedCategoryId && mongoose.Types.ObjectId.isValid(selectedCategoryId)) {
            fallbackCatId = selectedCategoryId;
         }
         if (!fallbackCatId) {
            let defaultCat = await Category.findOne({ projectId });
            if (!defaultCat) {
               defaultCat = await Category.create({
                  name: 'أصول عامة',
                  projectId,
                  level: 0,
                  path: ',أصول عامة,'
               });
            }
            fallbackCatId = defaultCat._id;
         }

         const employeeNames = newItems
            .map((a: any) => a.custodianName)
            .filter((name: any): name is string => typeof name === 'string' && name.trim() !== '');
         const matchedEmployees = await Employee.find({ name: { $in: employeeNames }, isActive: true });
         const employeeMap = new Map<string, string>();
         matchedEmployees.forEach(emp => {
            employeeMap.set(emp.name.trim().toLowerCase(), emp._id.toString());
         });

         const createdAssets = [];
         for (const item of newItems) {
            let systemId = item.systemId && typeof item.systemId === 'string' && item.systemId.trim() !== '' ? item.systemId.trim() : null;
            if (systemId) {
               const exists = await Asset.exists({ systemId });
               if (exists) systemId = null;
            }
            if (!systemId) {
               count++;
               systemId = `OMEGA-${currentYear}-${String(count).padStart(4, '0')}`;
            }

            const qrData = `${frontendUrl}/assets/${systemId}`;

            let currentCustodianId: string | undefined = undefined;
            if (item.custodianName) {
               currentCustodianId = employeeMap.get(item.custodianName.trim().toLowerCase());
            }

            let validCatId: any = undefined;
            if (item.categoryId && mongoose.Types.ObjectId.isValid(item.categoryId)) {
               validCatId = item.categoryId;
            } else {
               validCatId = fallbackCatId;
            }

            createdAssets.push(new Asset({
               systemId,
               projectId,
               categoryId: validCatId,
               name: item.name,
               quantity: Number(item.quantity || 1),
               serialNumber: item.serialNumber,
               purchaseDate: item.purchaseDate,
               purchaseCost: item.purchaseCost,
               vendor: item.vendor,
               condition: item.condition || 'good',
               notes: item.notes,
               specifications: item.specifications || {},
               qrCodeData: qrData,
               custodianName: item.custodianName,
               currentCustodianId: currentCustodianId || undefined,
               custodyStartDate: currentCustodianId ? new Date() : undefined,
               isActive: true,
               createdBy: req.user!._id,
            }));
         }

         if (createdAssets.length > 0) {
            await Asset.insertMany(createdAssets);
            addedCount = createdAssets.length;
         }
      }

      // 2. Update modified items
      if (Array.isArray(modifiedItems) && modifiedItems.length > 0) {
         const custNamesToResolve = modifiedItems
            .map((mod: any) => mod.updates?.custodianName)
            .filter((name: any): name is string => typeof name === 'string' && name.trim() !== '');

         let empMap = new Map<string, string>();
         if (custNamesToResolve.length > 0) {
            const emps = await Employee.find({ name: { $in: custNamesToResolve }, isActive: true });
            emps.forEach(emp => empMap.set(emp.name.trim().toLowerCase(), emp._id.toString()));
         }

         for (const mod of modifiedItems) {
            if (!mod.assetId || !mod.updates) continue;
            const updateFields: any = { ...mod.updates };

            if (updateFields.custodianName) {
               const empId = empMap.get(updateFields.custodianName.trim().toLowerCase());
               if (empId) {
                  updateFields.currentCustodianId = empId;
               }
            }

            if (updateFields.categoryId && !mongoose.Types.ObjectId.isValid(updateFields.categoryId)) {
               delete updateFields.categoryId;
            }

            await Asset.updateOne({ _id: mod.assetId, projectId }, { $set: updateFields });
            updatedCount++;
         }
      }

      // 3. Deactivate missing assets if requested
      if (Array.isArray(deactivateAssetIds) && deactivateAssetIds.length > 0) {
         const validMissingIds = deactivateAssetIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id));
         if (validMissingIds.length > 0) {
            const result = await Asset.updateMany(
               { _id: { $in: validMissingIds }, projectId },
               { $set: { isActive: false } }
            );
            deactivatedCount = result.modifiedCount;
         }
      }

      res.status(200).json({
         message: 'تم تطبيق المزامنة والتحديثات بنجاح',
         summary: {
            addedCount,
            updatedCount,
            deactivatedCount,
         },
      });
   } catch (error: any) {
      console.error('Reconcile apply error:', error?.message || error, error?.stack);
      res.status(500).json({ message: error?.message || 'Server error during reconciliation apply', detail: String(error) });
   }
};
