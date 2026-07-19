import { body, query, param, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation error', errors: errors.array() });
   }
   next();
};

export const validateProject = [
   body('name').trim().notEmpty().withMessage('Project name is required').isLength({ min: 3 }),
   body('location').trim().notEmpty().withMessage('Location is required'),
   body('description').optional().trim(),
   body('startDate').optional().isISO8601().withMessage('Invalid start date'),
   body('endDate').optional().isISO8601().withMessage('Invalid end date'),
   handleValidationErrors,
];

export const validateCategory = [
   body('projectId')
      .isMongoId()
      .withMessage('Invalid project ID'),
   body('name')
      .trim()
      .notEmpty()
      .withMessage('Category name is required')
      .isLength({ min: 2 }),
   body('parentId')
      .optional()
      .isMongoId()
      .withMessage('Invalid parent category ID'),
   handleValidationErrors,
];

export const validateAsset = [
   body('projectId')
      .isMongoId()
      .withMessage('Invalid project ID'),
   body('categoryId')
      .isMongoId()
      .withMessage('Invalid category ID'),
   body('name')
      .trim()
      .notEmpty()
      .withMessage('Asset name is required')
      .isLength({ min: 2 }),
   body('serialNumber')
      .optional()
      .trim(),
   body('purchaseDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid purchase date'),
   body('purchaseCost')
      .optional()
      .isNumeric()
      .withMessage('Purchase cost must be a number'),
   body('vendor')
      .optional()
      .trim(),
   body('condition')
      .optional()
      .isIn(['excellent', 'good', 'needs_repair', 'scrapped'])
      .withMessage('Invalid condition'),
   body('currentCustodianId')
      .optional()
      .isMongoId()
      .withMessage('Invalid custodian ID'),
   handleValidationErrors,
];

export const validateCustodyTransfer = [
   body('assetId')
      .isMongoId()
      .withMessage('Invalid asset ID'),
   body('toUserId')
      .isMongoId()
      .withMessage('Invalid user ID'),
   body('notes')
      .optional()
      .trim(),
   handleValidationErrors,
];

export const validateMaintenance = [
   body('assetId')
      .isMongoId()
      .withMessage('Invalid asset ID'),
   body('scheduledDate')
      .isISO8601()
      .withMessage('Invalid scheduled date'),
   body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 5 }),
   body('cost')
      .optional()
      .isNumeric()
      .withMessage('Cost must be a number'),
   handleValidationErrors,
];

export const validateMaintenanceUpdate = [
   body('status')
      .optional()
      .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
      .withMessage('Invalid status'),
   body('cost')
      .optional()
      .isNumeric()
      .withMessage('Cost must be a number'),
   handleValidationErrors,
];

export const validatePaginationQuery = [
   query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
   query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
   handleValidationErrors,
];

export const validateMongoId = (paramName: string = 'id') => [
   param(paramName)
      .isMongoId()
      .withMessage(`Invalid ${paramName}`),
   handleValidationErrors,
];

export const validateRegister = [
   body('email').trim().isEmail().withMessage('Valid email is required'),
   body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
   body('fullName').trim().notEmpty().withMessage('Full name is required'),
   handleValidationErrors,
];

export const validateLogin = [
   body('email').trim().isEmail().withMessage('Valid email is required'),
   body('password').notEmpty().withMessage('Password is required'),
   handleValidationErrors,
];
