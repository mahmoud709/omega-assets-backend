import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import categoryRoutes from './routes/categoryRoutes';
import assetRoutes from './routes/assetRoutes';
import custodyRoutes from './routes/custodyRoutes';
import maintenanceRoutes from './routes/maintenanceRoutes';
import reportRoutes from './routes/reportRoutes';
import userRoutes from './routes/userRoutes';
import employeeRoutes from './routes/employeeRoutes';
import companySettingsRoutes from './routes/companySettingsRoutes';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import { authenticate, authorize } from './middleware/auth';
import { reorderAssets } from './controllers/assetController';

dotenv.config();

const app: Application = express();

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
   origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://omega-assets.vercel.app'
   ],
   credentials: true,
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
   allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

// Direct reorder route registered at app level before assetRoutes router
app.post('/api/assets/reorder', authenticate, authorize('admin', 'site_manager', 'viewer'), reorderAssets as any);
app.put('/api/assets/reorder', authenticate, authorize('admin', 'site_manager', 'viewer'), reorderAssets as any);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/custody', custodyRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/company-settings', companySettingsRoutes);

// Health checks
app.get('/', (req, res) => { res.status(200).send('OK'); });
app.get('/api/health', (req, res) => { res.status(200).json({ status: 'ok', timestamp: new Date() }); });

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;