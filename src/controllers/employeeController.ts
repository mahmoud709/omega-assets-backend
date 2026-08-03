import { Request, Response } from 'express';
import Employee from '../models/Employee';
import { AuthRequest } from '../middleware/auth';
import Asset from '../models/Asset';
import CustodyLog from '../models/CustodyLog';

export const createEmployee = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, employees } = req.body;
      
      if (!Array.isArray(employees) || employees.length === 0) {
         return res.status(400).json({ message: 'No employees provided' });
      }

      const docs = employees.map(emp => {
         const primaryProject = emp.projectId || projectId;
         const rawProjectIds = Array.isArray(emp.projectIds) ? emp.projectIds : (primaryProject ? [primaryProject] : []);
         const uniqueProjectIds = Array.from(new Set([primaryProject, ...rawProjectIds].filter(Boolean)));

         return {
            name: emp.name,
            department: emp.department,
            projectId: primaryProject,
            projectIds: uniqueProjectIds,
            isOffice: emp.isOffice || false,
            members: emp.members || [],
         };
      });

      const created = await Employee.insertMany(docs);
      res.status(201).json({ message: `${created.length} employees created`, created });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getEmployees = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, search, page = 1, limit = 20 } = req.query;
      const query: any = { isActive: true };
      
      const filterProjectId = req.user!.role !== 'admin' && req.user!.siteId 
         ? req.user!.siteId 
         : projectId;

      if (filterProjectId) {
         const custodianIdsInProject = await Asset.distinct('currentCustodianId', { 
            projectId: filterProjectId, 
            currentCustodianId: { $ne: null },
            isActive: true 
         });

         const custodianNamesInProject = await Asset.distinct('custodianName', {
            projectId: filterProjectId,
            custodianName: { $nin: [null, '', 'المخزن'] },
            isActive: true
         });

         query.$or = [
            { projectId: filterProjectId },
            { projectIds: filterProjectId },
            { _id: { $in: custodianIdsInProject } },
            { name: { $in: custodianNamesInProject } }
         ];
      }

      if (search) {
         const searchFilter = { name: { $regex: search, $options: 'i' } };
         if (query.$or) {
            query.$and = [
               { $or: query.$or },
               searchFilter
            ];
            delete query.$or;
         } else {
            query.name = searchFilter.name;
         }
      }

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 20;
      const skip = (pageNum - 1) * limitNum;

      const [employees, total] = await Promise.all([
         Employee.find(query)
            .populate('projectId', 'name location')
            .populate('projectIds', 'name location')
            .populate('members', 'name')
            .sort({ name: 1 })
            .skip(skip)
            .limit(limitNum),
         Employee.countDocuments(query)
      ]);

      res.status(200).json({ 
         message: 'Employees retrieved', 
         data: employees,
         pagination: {
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            limit: limitNum
         }
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getEmployeeById = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const employee = await Employee.findById(id)
         .populate('projectId', 'name location')
         .populate('projectIds', 'name location')
         .populate('members', 'name');
      
      if (!employee) {
         return res.status(404).json({ message: 'Employee not found' });
      }

      // Self-healing: Associate any assets matching this employee's name that lack currentCustodianId
      await Asset.updateMany(
         { custodianName: employee.name, currentCustodianId: null },
         { $set: { currentCustodianId: employee._id } }
      );

      res.status(200).json({ message: 'Employee retrieved', data: employee });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const updateEmployee = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const { name, department, projectId, projectIds, isOffice, members } = req.body;
      
      const oldEmployee = await Employee.findById(id);
      if (!oldEmployee) {
         return res.status(404).json({ message: 'Employee not found' });
      }
      const oldName = oldEmployee.name;

      const primaryProject = projectId || (Array.isArray(projectIds) && projectIds.length > 0 ? projectIds[0] : oldEmployee.projectId);
      const rawProjectIds = Array.isArray(projectIds) && projectIds.length > 0 
         ? projectIds 
         : (primaryProject ? [primaryProject] : (oldEmployee.projectIds || []));
      const uniqueProjectIds = Array.from(new Set([primaryProject, ...rawProjectIds].filter(Boolean)));

      const employee = await Employee.findByIdAndUpdate(
         id,
         { 
            name, 
            department, 
            projectId: primaryProject, 
            projectIds: uniqueProjectIds,
            isOffice, 
            members 
         },
         { new: true, runValidators: true }
      ).populate('projectId', 'name location').populate('projectIds', 'name location').populate('members', 'name');
      
      if (!employee) {
         return res.status(404).json({ message: 'Employee not found' });
      }

      // Sync name changes to all assigned assets
      if (name && name !== oldName) {
         await Asset.updateMany(
            {
               $or: [
                  { currentCustodianId: employee._id },
                  { custodianName: oldName }
               ]
            },
            {
               $set: {
                  currentCustodianId: employee._id,
                  custodianName: name
               }
            }
         );
      }

      res.status(200).json({ message: 'Employee updated', data: employee });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const deleteEmployee = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const { reassignments } = req.body;
      
      const employee = await Employee.findById(id);
      if (!employee) {
         return res.status(404).json({ message: 'Employee not found' });
      }

      // Soft delete the employee
      employee.isActive = false;
      await employee.save();

      // Find all assets currently assigned to this employee
      const assets = await Asset.find({
         $or: [
            { currentCustodianId: employee._id },
            { custodianName: employee.name }
         ]
      });

      if (assets.length > 0) {
         // Create a map of reassignments: assetId -> toEmployeeId
         const reassignmentMap = new Map<string, string>();
         if (Array.isArray(reassignments)) {
            for (const r of reassignments) {
               if (r.assetId && r.toEmployeeId) {
                  reassignmentMap.set(r.assetId.toString(), r.toEmployeeId.toString());
               }
            }
         }

         // Process each asset
         for (const asset of assets) {
            const targetEmployeeId = reassignmentMap.get(asset._id.toString());
            
            if (targetEmployeeId && targetEmployeeId !== 'stock') {
               // Reassign to another employee
               const targetEmployee = await Employee.findById(targetEmployeeId);
               if (targetEmployee) {
                  const log = new CustodyLog({
                     assetId: asset._id,
                     fromProjectId: asset.projectId,
                     toProjectId: targetEmployee.projectId || asset.projectId,
                     fromUserId: asset.currentCustodianId,
                     fromUserName: asset.custodianName,
                     toUserId: targetEmployee._id,
                     toUserName: targetEmployee.name,
                     transferredAt: new Date(),
                     notes: `نقل عهدة تلقائي بسبب حذف المسؤول السابق (${employee.name})`,
                  });
                  await log.save();

                  asset.currentCustodianId = targetEmployee._id as any;
                  asset.custodianName = targetEmployee.name;
                  asset.custodyStartDate = new Date();
                  if (targetEmployee.projectId) {
                     asset.projectId = targetEmployee.projectId;
                  }
                  await asset.save();
               } else {
                  // Fallback to stock if employee not found
                  const log = new CustodyLog({
                     assetId: asset._id,
                     fromProjectId: asset.projectId,
                     toProjectId: asset.projectId,
                     fromUserId: asset.currentCustodianId,
                     fromUserName: asset.custodianName,
                     toUserName: 'المخزن',
                     transferredAt: new Date(),
                     notes: `إرجاع تلقائي للمخزن بسبب حذف الموظف/الجهة: ${employee.name}`,
                  });
                  await log.save();

                  asset.currentCustodianId = undefined;
                  asset.custodianName = undefined;
                  asset.custodyStartDate = undefined;
                  await asset.save();
               }
            } else {
               // Return to stock
               const log = new CustodyLog({
                  assetId: asset._id,
                  fromProjectId: asset.projectId,
                  toProjectId: asset.projectId,
                  fromUserId: asset.currentCustodianId,
                  fromUserName: asset.custodianName,
                  toUserName: 'المخزن',
                  transferredAt: new Date(),
                  notes: `إرجاع تلقائي للمخزن بسبب حذف الموظف/الجهة: ${employee.name}`,
               });
               await log.save();

               asset.currentCustodianId = undefined;
               asset.custodianName = undefined;
               asset.custodyStartDate = undefined;
               await asset.save();
            }
         }
      }

      res.status(200).json({ message: 'Employee deleted and assets reassigned successfully' });
   } catch (error) {
      console.error('Delete employee error:', error);
      res.status(500).json({ message: 'Server error', error });
   }
};

