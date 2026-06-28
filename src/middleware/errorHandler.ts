import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
   console.error(err.stack);
   res.status(err.status || 500).json({
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
   });
};

export const notFoundHandler = (req: Request, res: Response) => {
   res.status(404).json({ message: 'Route not found' });
};