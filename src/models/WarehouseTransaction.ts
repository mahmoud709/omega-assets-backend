import mongoose, { Schema, Document } from 'mongoose';

export interface ITransactionItem {
   assetId?: mongoose.Types.ObjectId;
   name: string;
   categoryId?: mongoose.Types.ObjectId;
   quantity: number;
   unit?: string;
   condition?: 'excellent' | 'good' | 'bad' | 'needs_repair' | 'scrapped';
   unitCost?: number;
   notes?: string;
}

export interface IWarehouseTransaction extends Document {
   transactionNumber: string;
   type: 'inward_supply' | 'outward_issue' | 'project_transfer';
   projectId: mongoose.Types.ObjectId;
   targetProjectId?: mongoose.Types.ObjectId;
   
   vendorOrSupplier?: string;
   invoiceNumber?: string;
   recipientName?: string;
   recipientEmployeeId?: mongoose.Types.ObjectId;
   
   items: ITransactionItem[];
   
   status: 'draft' | 'pending' | 'completed' | 'cancelled';
   transferStatus?: 'pending_approval' | 'in_transit' | 'received' | 'rejected';
   
   notes?: string;
   attachmentUrl?: string;
   
   createdBy: mongoose.Types.ObjectId;
   createdByName?: string;
   approvedBy?: mongoose.Types.ObjectId;
   approvedByName?: string;
   receivedBy?: mongoose.Types.ObjectId;
   receivedByName?: string;
   
   createdAt: Date;
   updatedAt: Date;
}

const TransactionItemSchema = new Schema({
   assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
   name: { type: String, required: true },
   categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
   quantity: { type: Number, required: true, default: 1 },
   unit: { type: String, default: 'عدد' },
   condition: { type: String, enum: ['excellent', 'good', 'bad', 'needs_repair', 'scrapped'], default: 'good' },
   unitCost: { type: Number },
   notes: { type: String },
});

const WarehouseTransactionSchema = new Schema<IWarehouseTransaction>(
   {
      transactionNumber: { type: String, required: true, unique: true },
      type: {
         type: String,
         enum: ['inward_supply', 'outward_issue', 'project_transfer'],
         required: true,
      },
      projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
      targetProjectId: { type: Schema.Types.ObjectId, ref: 'Project' },
      
      vendorOrSupplier: { type: String },
      invoiceNumber: { type: String },
      recipientName: { type: String },
      recipientEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
      
      items: [TransactionItemSchema],
      
      status: { type: String, enum: ['draft', 'pending', 'completed', 'cancelled'], default: 'completed' },
      transferStatus: { type: String, enum: ['pending_approval', 'in_transit', 'received', 'rejected'] },
      
      notes: { type: String },
      attachmentUrl: { type: String },
      
      createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      createdByName: { type: String },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      approvedByName: { type: String },
      receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      receivedByName: { type: String },
   },
   { timestamps: true }
);

WarehouseTransactionSchema.index({ projectId: 1, type: 1 });
WarehouseTransactionSchema.index({ transactionNumber: 1 });

export default mongoose.model<IWarehouseTransaction>('WarehouseTransaction', WarehouseTransactionSchema);
