import mongoose, { Schema, Document } from 'mongoose';

export interface ICompanySettings extends Document {
  facebook: string;
  instagram: string;
  whatsapp: string;
  whatsappDisplay: string;
  email: string;
  logo?: string;
  updatedAt: Date;
}

const CompanySettingsSchema = new Schema<ICompanySettings>(
  {
    facebook:        { type: String, default: 'https://facebook.com/OmegaContractors' },
    instagram:       { type: String, default: 'https://instagram.com/OmegaContractors' },
    whatsapp:        { type: String, default: 'https://wa.me/201234567890' },
    whatsappDisplay: { type: String, default: '+20 123 456 7890' },
    email:           { type: String, default: 'info@omega-contractors.com' },
    logo:            { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<ICompanySettings>('CompanySettings', CompanySettingsSchema);
