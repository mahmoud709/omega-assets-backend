import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import WarehouseTransaction from '../models/WarehouseTransaction';
import Asset from '../models/Asset';
import CustodyLog from '../models/CustodyLog';
import Employee from '../models/Employee';
import mongoose from 'mongoose';

export const createSupplyOrder = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, vendorOrSupplier, invoiceNumber, items, notes } = req.body;

      if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
         return res.status(400).json({ message: 'المشروع محدد غير صالح' });
      }
      if (!Array.isArray(items) || items.length === 0) {
         return res.status(400).json({ message: 'يرجى إدراج عنصر واحد على الأقل في أمر التوريد' });
      }

      // Check role authorization
      if (req.user!.role !== 'admin' && req.user!.siteId && req.user!.siteId.toString() !== projectId) {
         return res.status(403).json({ message: 'غير مصرح لك بإجراء حركة توريد على هذا المشروع' });
      }

      const year = new Date().getFullYear();
      const count = await WarehouseTransaction.countDocuments({ type: 'inward_supply' });
      const transactionNumber = `SUP-${year}-${String(count + 1).padStart(4, '0')}`;

      const processedItems: any[] = [];
      let totalAssetCount = await Asset.countDocuments();

      for (const item of items) {
         let targetAsset: any = null;

         if (item.assetId && mongoose.Types.ObjectId.isValid(item.assetId)) {
            targetAsset = await Asset.findById(item.assetId);
         }

         const qtyToAdd = Number(item.quantity) || 1;

         if (targetAsset) {
            targetAsset.quantity = (targetAsset.quantity || 0) + qtyToAdd;
            if (item.condition) targetAsset.condition = item.condition;
            if (item.unitCost) targetAsset.purchaseCost = Number(item.unitCost);
            await targetAsset.save();
         } else {
            totalAssetCount++;
            const systemId = `OMEGA-${year}-${String(totalAssetCount).padStart(4, '0')}`;
            const qrData = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assets/${systemId}`;

            targetAsset = new Asset({
               systemId,
               projectId,
               categoryId: item.categoryId,
               name: item.name,
               quantity: qtyToAdd,
               unit: item.unit || 'عدد',
               condition: item.condition || 'good',
               purchaseCost: item.unitCost ? Number(item.unitCost) : undefined,
               notes: item.notes,
               qrCodeData: qrData,
               isActive: true,
               createdBy: req.user!._id,
            });
            await targetAsset.save();
         }

         processedItems.push({
            assetId: targetAsset._id,
            name: targetAsset.name,
            categoryId: targetAsset.categoryId,
            quantity: qtyToAdd,
            unit: targetAsset.unit || item.unit || 'عدد',
            condition: targetAsset.condition,
            unitCost: item.unitCost ? Number(item.unitCost) : undefined,
            notes: item.notes,
         });

         // Custody Log record
         const log = new CustodyLog({
            assetId: targetAsset._id,
            fromUserName: vendorOrSupplier ? `المورد: ${vendorOrSupplier}` : 'توريد خارجي',
            toUserName: 'المخزن',
            toProjectId: projectId,
            notes: `أمر توريد رقم ${transactionNumber}${invoiceNumber ? ` (فاتورة: ${invoiceNumber})` : ''}`,
         });
         await log.save();
      }

      const transaction = new WarehouseTransaction({
         transactionNumber,
         type: 'inward_supply',
         projectId,
         vendorOrSupplier,
         invoiceNumber,
         items: processedItems,
         status: 'completed',
         notes,
         createdBy: req.user!._id,
         createdByName: req.user!.fullName,
      });

      await transaction.save();

      res.status(201).json({
         message: `تم إنشاء أمر التوريد بنجاح (رقم: ${transactionNumber})`,
         transaction,
      });
   } catch (error) {
      console.error('Create supply order error:', error);
      res.status(500).json({ message: 'Server error', error });
   }
};

export const createIssueOrder = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, targetProjectId, recipientName, recipientEmployeeId, items, notes } = req.body;

      if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
         return res.status(400).json({ message: 'المشروع محدد غير صالح' });
      }
      if (!recipientName && !recipientEmployeeId) {
         return res.status(400).json({ message: 'يرجى تحديد المستلم أو اختيار موظف' });
      }
      if (!Array.isArray(items) || items.length === 0) {
         return res.status(400).json({ message: 'يرجى إدراج عنصر واحد على الأقل في أمر الصرف' });
      }

      if (req.user!.role !== 'admin' && req.user!.siteId && req.user!.siteId.toString() !== projectId) {
         return res.status(403).json({ message: 'غير مصرح لك بإجراء أمر صرف على هذا المشروع' });
      }

      let employeeName = recipientName;
      let empIdObj: any = undefined;

      if (recipientEmployeeId && mongoose.Types.ObjectId.isValid(recipientEmployeeId)) {
         const emp = await Employee.findById(recipientEmployeeId);
         if (emp) {
            employeeName = emp.name;
            empIdObj = emp._id;
         }
      }

      const year = new Date().getFullYear();
      const count = await WarehouseTransaction.countDocuments({ type: 'outward_issue' });
      const transactionNumber = `ISS-${year}-${String(count + 1).padStart(4, '0')}`;

      const processedItems: any[] = [];

      for (const item of items) {
         if (!item.assetId || !mongoose.Types.ObjectId.isValid(item.assetId)) {
            continue;
         }

         const asset = await Asset.findById(item.assetId);
         if (!asset) continue;

         const qtyToIssue = Number(item.quantity) || 1;

         if ((asset.quantity || 1) < qtyToIssue) {
            return res.status(400).json({
               message: `الكمية المطلوبة للصرف (${qtyToIssue}) أكبر من الكمية المتاحة للأصل "${asset.name}" (${asset.quantity || 1})`
            });
         }

         if (asset.quantity === qtyToIssue) {
            asset.custodianName = employeeName;
            asset.currentCustodianId = empIdObj || undefined;
            asset.custodyStartDate = new Date();
            await asset.save();
         } else {
            // Deduct quantity from main stock asset
            asset.quantity = asset.quantity - qtyToIssue;
            await asset.save();

            // Create a secondary custody entry for the recipient
            const countAll = await Asset.countDocuments();
            const systemId = `OMEGA-${year}-${String(countAll + 1).padStart(4, '0')}`;
            const qrData = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assets/${systemId}`;

            const subAsset = new Asset({
               systemId,
               projectId: asset.projectId,
               categoryId: asset.categoryId,
               name: asset.name,
               quantity: qtyToIssue,
               unit: asset.unit || 'عدد',
               condition: asset.condition,
               notes: `منصرف بموجب أمر صرف رقم ${transactionNumber}`,
               qrCodeData: qrData,
               custodianName: employeeName,
               currentCustodianId: empIdObj || undefined,
               custodyStartDate: new Date(),
               isActive: true,
               createdBy: req.user!._id,
            });
            await subAsset.save();
         }

         processedItems.push({
            assetId: asset._id,
            name: asset.name,
            categoryId: asset.categoryId,
            quantity: qtyToIssue,
            unit: asset.unit || 'عدد',
            condition: asset.condition,
            notes: item.notes,
         });

         const log = new CustodyLog({
            assetId: asset._id,
            fromUserName: 'المخزن',
            toUserName: employeeName,
            toUserId: empIdObj,
            notes: `أمر صرف مخزني رقم ${transactionNumber}`,
         });
         await log.save();
      }

      const transaction = new WarehouseTransaction({
         transactionNumber,
         type: 'outward_issue',
         projectId,
         targetProjectId: targetProjectId && mongoose.Types.ObjectId.isValid(targetProjectId) ? targetProjectId : undefined,
         recipientName: employeeName,
         recipientEmployeeId: empIdObj,
         items: processedItems,
         status: 'completed',
         notes,
         createdBy: req.user!._id,
         createdByName: req.user!.fullName,
      });

      await transaction.save();

      res.status(201).json({
         message: `تم إنشاء أمر الصرف بنجاح (رقم: ${transactionNumber})`,
         transaction,
      });
   } catch (error) {
      console.error('Create issue order error:', error);
      res.status(500).json({ message: 'Server error', error });
   }
};

export const createTransferOrder = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, targetProjectId, items, notes } = req.body;

      if (!projectId || !targetProjectId || projectId === targetProjectId) {
         return res.status(400).json({ message: 'يرجى تحديد المشروع المصدر والمشروع المستهدف بوضوح' });
      }
      if (!Array.isArray(items) || items.length === 0) {
         return res.status(400).json({ message: 'يرجى إدراج عنصر واحد على الأقل في أمر النقل' });
      }

      if (req.user!.role !== 'admin' && req.user!.siteId && req.user!.siteId.toString() !== projectId) {
         return res.status(403).json({ message: 'غير مصرح لك بإجراء أمر نقل من هذا المشروع' });
      }

      const year = new Date().getFullYear();
      const count = await WarehouseTransaction.countDocuments({ type: 'project_transfer' });
      const transactionNumber = `TRF-${year}-${String(count + 1).padStart(4, '0')}`;

      const processedItems: any[] = [];

      for (const item of items) {
         if (!item.assetId || !mongoose.Types.ObjectId.isValid(item.assetId)) continue;

         const asset = await Asset.findById(item.assetId);
         if (!asset) continue;

         const qtyToTransfer = Number(item.quantity) || 1;

         if (asset.quantity === qtyToTransfer) {
            asset.projectId = targetProjectId;
            asset.custodianName = undefined;
            asset.currentCustodianId = undefined;
            await asset.save();
         } else if ((asset.quantity || 1) > qtyToTransfer) {
            asset.quantity = asset.quantity - qtyToTransfer;
            await asset.save();

            const countAll = await Asset.countDocuments();
            const systemId = `OMEGA-${year}-${String(countAll + 1).padStart(4, '0')}`;
            const qrData = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/assets/${systemId}`;

            const newAsset = new Asset({
               systemId,
               projectId: targetProjectId,
               categoryId: asset.categoryId,
               name: asset.name,
               quantity: qtyToTransfer,
               unit: asset.unit || 'عدد',
               condition: asset.condition,
               notes: `منقول من مشروع سابق بموجب إذن نقل ${transactionNumber}`,
               qrCodeData: qrData,
               isActive: true,
               createdBy: req.user!._id,
            });
            await newAsset.save();
         }

         processedItems.push({
            assetId: asset._id,
            name: asset.name,
            categoryId: asset.categoryId,
            quantity: qtyToTransfer,
            unit: asset.unit || 'عدد',
            condition: asset.condition,
            notes: item.notes,
         });

         const log = new CustodyLog({
            assetId: asset._id,
            fromProjectId: projectId,
            toProjectId: targetProjectId,
            notes: `أمر نقل بين المشاريع رقم ${transactionNumber}`,
         });
         await log.save();
      }

      const transaction = new WarehouseTransaction({
         transactionNumber,
         type: 'project_transfer',
         projectId,
         targetProjectId,
         items: processedItems,
         status: 'completed',
         transferStatus: 'received',
         notes,
         createdBy: req.user!._id,
         createdByName: req.user!.fullName,
      });

      await transaction.save();

      res.status(201).json({
         message: `تم إنشاء إذن النقل بين المشاريع بنجاح (رقم: ${transactionNumber})`,
         transaction,
      });
   } catch (error) {
      console.error('Create transfer order error:', error);
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, type, status, page = 1, limit = 20 } = req.query;
      const query: any = {};

      if (projectId) query.projectId = projectId;
      if (type) query.type = type;
      if (status) query.status = status;

      if (req.user && req.user.role !== 'admin' && req.user.siteId) {
         query.$or = [{ projectId: req.user.siteId }, { targetProjectId: req.user.siteId }];
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, parseInt(limit as string) || 20);
      const skip = (pageNum - 1) * limitNum;

      const transactions = await WarehouseTransaction.find(query)
         .populate('projectId', 'name location')
         .populate('targetProjectId', 'name location')
         .populate('recipientEmployeeId', 'name position department')
         .populate('createdBy', 'fullName email')
         .populate('items.categoryId', 'name')
         .sort({ createdAt: -1 })
         .skip(skip)
         .limit(limitNum);

      const total = await WarehouseTransaction.countDocuments(query);

      res.status(200).json({
         message: 'Transactions retrieved',
         data: transactions,
         pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getTransactionById = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
      const query = isObjectId ? { _id: id } : { transactionNumber: id };

      const transaction = await WarehouseTransaction.findOne(query)
         .populate('projectId', 'name location managerName')
         .populate('targetProjectId', 'name location managerName')
         .populate('recipientEmployeeId', 'name position department nationalId phone')
         .populate('createdBy', 'fullName email role')
         .populate('items.categoryId', 'name')
         .populate('items.assetId', 'systemId name serialNumber');

      if (!transaction) {
         return res.status(404).json({ message: 'Transaction order not found' });
      }

      res.status(200).json({ message: 'Transaction retrieved', transaction });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};
