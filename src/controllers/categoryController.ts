import { Response } from 'express';
import Category from '../models/Category';
import Asset from '../models/Asset';
import { AuthRequest } from '../middleware/auth';

export const createCategory = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, name, parentId } = req.body;

      // Prevent duplicate categories within the same project
      const existingCategory = await Category.findOne({ projectId, name });
      if (existingCategory) {
         return res.status(400).json({ message: 'الفئة موجودة مسبقاً في هذا المشروع' });
      }

      let level = 1;
      let path = name;

      if (parentId) {
         const parent = await Category.findById(parentId);
         if (!parent) {
            return res.status(404).json({ message: 'Parent category not found' });
         }
         if (parent.projectId.toString() !== projectId) {
            return res.status(400).json({ message: 'Parent category must belong to same project' });
         }
         level = parent.level + 1;
         path = `${parent.path}/${name}`;
      }

      const category = new Category({
         projectId,
         name,
         parentId: parentId || undefined,
         level,
         path,
      });

      await category.save();

      res.status(201).json({ message: 'Category created', category });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getCategories = async (req: AuthRequest, res: Response) => {
   try {
      const { projectId, parentId, page = 1, limit = 50 } = req.query;
      const query: any = {};

      if (projectId) query.projectId = projectId;
      if (parentId) {
         query.parentId = parentId;
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, parseInt(limit as string) || 50);
      const skip = (pageNum - 1) * limitNum;

      const categories = await Category.find(query)
         .populate('parentId', 'name path')
         .skip(skip)
         .limit(limitNum)
         .sort({ path: 1 });

      const total = await Category.countDocuments(query);

      res.status(200).json({
         message: 'Categories retrieved',
         data: categories,
         pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const getCategoryById = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;

      const category = await Category.findById(id)
         .populate('parentId', 'name path')
         .populate('projectId', 'name');

      if (!category) {
         return res.status(404).json({ message: 'Category not found' });
      }

      const children = await Category.find({ parentId: id }).select('name path level');

      res.status(200).json({
         message: 'Category retrieved',
         category,
         children,
      });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;
      const { name } = req.body;

      const category = await Category.findById(id);
      if (!category) {
         return res.status(404).json({ message: 'Category not found' });
      }

      if (name) {
         const newPath = category.parentId
            ? await Category.findById(category.parentId).then((p) => `${p?.path}/${name}`)
            : name;
         category.path = newPath;
         category.name = name;

         await category.save();
      }

      res.status(200).json({ message: 'Category updated', category });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
   try {
      const { id } = req.params;

      const category = await Category.findById(id);
      if (!category) {
         return res.status(404).json({ message: 'Category not found' });
      }

      const childCount = await Category.countDocuments({ parentId: id });
      if (childCount > 0) {
         return res.status(400).json({ message: 'Cannot delete category with child categories' });
      }

      const assetCount = await Asset.countDocuments({ categoryId: id });
      if (assetCount > 0) {
         return res.status(400).json({ message: 'Cannot delete category with associated assets' });
      }

      await Category.deleteOne({ _id: id });

      res.status(200).json({ message: 'Category deleted' });
   } catch (error) {
      res.status(500).json({ message: 'Server error', error });
   }
};
