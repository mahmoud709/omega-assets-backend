import { Response } from 'express';
import Project from '../models/Project';
import { AuthRequest } from '../middleware/auth';

import Category from '../models/Category';
import Employee from '../models/Employee';

export const createProject = async (req: AuthRequest, res: Response) => {
   try {
      const { name, location, description, startDate, endDate } = req.body;

      const project = new Project({
         name,
         location,
         description,
         startDate,
         endDate,
         isActive: true,
         createdBy: req.user!._id,
      });

      await project.save();

      // Automatically create some default categories for this project
      const defaultCategories = ['إلكترونيات', 'مركبات', 'معدات ثقيلة', 'أدوات مكتبية', 'أثاث'];
      const categoriesToInsert = defaultCategories.map(catName => ({
         projectId: project._id,
         name: catName,
         level: 1,
         path: catName,
      }));
      
      await Category.insertMany(categoriesToInsert);

      // Automatically create a "Warehouse" (المخزن) employee for this project
      const defaultWarehouse = new Employee({
         name: 'المخزن',
         department: 'مخزن المشروع',
         projectId: project._id,
      });
      await defaultWarehouse.save();

      res.status(201).json({ message: 'Project created with default categories and warehouse', project });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getProjects = async (req: AuthRequest, res: Response) => {
   try {
      const { isActive = true, location, page = 1, limit = 20 } = req.query;
      const query: any = {};

      if (isActive !== undefined) {
         query.isActive = isActive === 'true' || isActive === true;
      }
      if (location) {
         query.location = { $regex: location, $options: 'i' };
      }

      // Role-based filtering: strict project isolation
      if (req.user!.role !== 'admin') {
         if (req.user!.siteId) {
            query._id = req.user!.siteId;
         } else {
            // If user is not admin and has no assigned project, they see nothing
            return res.status(200).json({ message: 'Projects retrieved', data: [], pagination: { total: 0, pages: 0, page: 1, limit: 20 } });
         }
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, parseInt(limit as string) || 20);
      const skip = (pageNum - 1) * limitNum;

      const projects = await Project.find(query)
         .populate('createdBy', 'fullName email')
         .skip(skip)
         .limit(limitNum)
         .sort({ createdAt: -1 });

      const total = await Project.countDocuments(query);

      res.status(200).json({
         message: 'Projects retrieved',
         data: projects,
         pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getProjectById = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;

      const project = await Project.findById(id).populate('createdBy', 'fullName email');

      if (!project) {
         return res.status(404).json({ message: 'Project not found' });
      }

      res.status(200).json({ message: 'Project retrieved', project });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const { name, location, description, startDate, endDate, isActive } = req.body;

      const project = await Project.findById(id);
      if (!project) {
         return res.status(404).json({ message: 'Project not found' });
      }

      if (name) project.name = name;
      if (location) project.location = location;
      if (description !== undefined) project.description = description;
      if (startDate) project.startDate = startDate;
      if (endDate) project.endDate = endDate;
      if (isActive !== undefined) project.isActive = isActive;

      await project.save();

      res.status(200).json({ message: 'Project updated', project });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;

      const project = await Project.findById(id);
      if (!project) {
         return res.status(404).json({ message: 'Project not found' });
      }

      project.isActive = false;
      await project.save();

      res.status(200).json({ message: 'Project soft-deleted' });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};
