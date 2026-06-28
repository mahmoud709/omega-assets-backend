import { Request, Response } from 'express';
import Employee from '../models/Employee';
import { AuthRequest } from '../middleware/auth';

export const createEmployee = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, employees } = req.body;
      
      if (!Array.isArray(employees) || employees.length === 0) {
         return res.status(400).json({ message: 'No employees provided' });
      }

      const docs = employees.map(emp => ({
         name: emp.name,
         department: emp.department,
         projectId,
      }));

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
      
      if (projectId) query.projectId = projectId;
      if (search) {
         query.name = { $regex: search, $options: 'i' };
      }
      
      // Role-based filtering
      if (req.user!.role !== 'admin' && req.user!.siteId) {
         query.projectId = req.user!.siteId;
      }

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 20;
      const skip = (pageNum - 1) * limitNum;

      const [employees, total] = await Promise.all([
         Employee.find(query)
            .populate('projectId', 'name')
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
      const employee = await Employee.findById(id).populate('projectId', 'name location');
      
      if (!employee) {
         return res.status(404).json({ message: 'Employee not found' });
      }

      res.status(200).json({ message: 'Employee retrieved', data: employee });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};
