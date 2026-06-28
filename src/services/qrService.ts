import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const QR_STORAGE_PATH = process.env.QR_STORAGE_PATH || './uploads/qr';

// Ensure directory exists
if (!fs.existsSync(QR_STORAGE_PATH)) {
   fs.mkdirSync(QR_STORAGE_PATH, { recursive: true });
}

export const generateQR = async (data: string): Promise<string> => {
   try {
      const fileName = `${uuidv4()}.png`;
      const filePath = path.join(QR_STORAGE_PATH, fileName);
      await QRCode.toFile(filePath, data, {
         width: 300,
         margin: 2,
         color: {
            dark: '#000000',
            light: '#ffffff',
         },
      });
      return `/uploads/qr/${fileName}`; // URL path
   } catch (error) {
      throw new Error('QR generation failed');
   }
};

// For API response you may also return base64 if you prefer
export const generateQRBase64 = async (data: string): Promise<string> => {
   return await QRCode.toDataURL(data);
};