import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
   destination: (req, file, cb) => {
      cb(null, process.env.ASSET_IMAGE_PATH || './uploads/assets');
   },
   filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}${ext}`);
   },
});

export const upload = multer({
   storage,
   limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
   fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowed.includes(file.mimetype)) {
         cb(null, true);
      } else {
         cb(new Error('Invalid file type. Only JPEG, PNG, WEBP allowed.'));
      }
   },
});