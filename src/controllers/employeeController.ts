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
      const { projectId } = req.query;
      const query: any = { isActive: true };
      
      if (projectId) query.projectId = projectId;
      
      // Role-based filtering
      if (req.user!.role !== 'admin' && req.user!.siteId) {
         query.projectId = req.user!.siteId;
      }

      const employees = await Employee.find(query).populate('projectId', 'name').sort({ name: 1 });
      res.status(200).json({ message: 'Employees retrieved', data: employees });
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
