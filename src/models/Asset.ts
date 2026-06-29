import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
   systemId: string;
   projectId: mongoose.Types.ObjectId;
   categoryId: mongoose.Types.ObjectId;
   name: string;
   serialNumber?: string;
   purchaseDate?: Date;
   purchaseCost?: number;
   vendor?: string;
   condition: 'excellent' | 'good' | 'needs_repair' | 'scrapped';
   notes?: string;
   specifications?: Map<string, any>;
   qrCodeData: string;      // URL or content
   qrCodeImage?: string;    // path to image
   quantity: number;        // For bulk items like scaffolding
   currentCustodianId?: mongoose.Types.ObjectId;
   custodianName?: string;
   custodyStartDate?: Date;
   maintenanceSchedule?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      nextDueDate: Date;
      lastPerformed?: Date;
      notes?: string;
   };
   isActive: boolean;
   createdBy: mongoose.Types.ObjectId;
   createdAt: Date;
   updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
   {
      systemId: { type: String, required: true, unique: true },
      projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
      categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
      name: { type: String, required: true },
      quantity: { type: Number, default: 1 },
      serialNumber: { type: String },
      purchaseDate: { type: Date },
      purchaseCost: { type: Number },
      vendor: { type: String },
      condition: {
         type: String,
         enum: ['excellent', 'good', 'needs_repair', 'scrapped'],
         default: 'good',
      },
      notes: { type: String },
      specifications: { type: Map, of: Schema.Types.Mixed },
      qrCodeData: { type: String, required: true },
      qrCodeImage: { type: String },
      currentCustodianId: { type: Schema.Types.ObjectId, ref: 'User' },
      custodianName: { type: String },
      custodyStartDate: { type: Date },
      maintenanceSchedule: {
         frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
         nextDueDate: { type: Date },
         lastPerformed: { type: Date },
         notes: { type: String },
      },
      isActive: { type: Boolean, default: true },
      createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
   },
   { timestamps: true }
);

// Indexes
AssetSchema.index({ projectId: 1, systemId: 1 });
AssetSchema.index({ currentCustodianId: 1 });

export default mongoose.model<IAsset>('Asset', AssetSchema);