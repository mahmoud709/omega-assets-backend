import { Request, Response } from 'express';
import CompanySettings from '../models/CompanySettings';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

// GET /api/company-settings — public
export const getCompanySettings = async (req: Request, res: Response) => {
  try {
    // Always find or create the single settings document
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({});
    }
    res.status(200).json(settings);
  } catch (error) {
    console.error('getCompanySettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/company-settings — admin only
export const updateCompanySettings = async (req: AuthRequest, res: Response) => {
  try {
    const { facebook, instagram, whatsapp, whatsappDisplay, email } = req.body;

    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({ facebook, instagram, whatsapp, whatsappDisplay, email });
    } else {
      if (facebook        !== undefined) settings.facebook        = facebook;
      if (instagram       !== undefined) settings.instagram       = instagram;
      if (whatsapp        !== undefined) settings.whatsapp        = whatsapp;
      if (whatsappDisplay !== undefined) settings.whatsappDisplay = whatsappDisplay;
      if (email           !== undefined) settings.email           = email;
      if ((req as any).body.logo !== undefined) settings.logo = (req as any).body.logo;
      await settings.save();
    }

    res.status(200).json({ message: 'تم حفظ إعدادات الشركة بنجاح', data: settings });
  } catch (error) {
    console.error('updateCompanySettings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/company-settings/logo — admin only, multipart/form-data (field: logo)
export const uploadCompanyLogo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const filePath = `/uploads/assets/${req.file.filename}`;

    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({ logo: filePath });
    } else {
      // delete previous logo file if present
      if (settings.logo) {
        const prev = path.join(process.cwd(), settings.logo.replace(/\//g, path.sep));
        try { if (fs.existsSync(prev)) fs.unlinkSync(prev); } catch (e) { /* ignore */ }
      }
      settings.logo = filePath;
      await settings.save();
    }

    res.status(200).json({ message: 'Logo uploaded', data: settings });
  } catch (error) {
    console.error('uploadCompanyLogo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
