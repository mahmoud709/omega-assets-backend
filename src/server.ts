import app from './app';
import dotenv from 'dotenv';
import { initializeScheduler } from './services/scheduler';

dotenv.config({ override: true });

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
   console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

initializeScheduler();

process.on('SIGTERM', () => {
   console.log('SIGTERM received, shutting down gracefully');
   server.close(() => {
      console.log('Server closed');
      process.exit(0);
   });
});