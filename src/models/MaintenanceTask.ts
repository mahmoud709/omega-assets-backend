import mongoose, { Schema, Document } from 'mongoose';

export interface IMaintenanceTask extends Document {
   assetId: mongoose.Types.ObjectId;
   scheduledDate: Date;
   completedDate?: Date;
   status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
   description: string;
   cost?: number;
   performedBy?: mongoose.Types.ObjectId;
   createdAt: Date;
   updatedAt: Date;
}

const MaintenanceTaskSchema = new Schema<IMaintenanceTask>(
   {
      assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
      scheduledDate: { type: Date, required: true },
      completedDate: { type: Date },
      status: {
         type: String,
         enum: ['pending', 'in_progress', 'completed', 'cancelled'],
         default: 'pending',
      },
      description: { type: String, required: true },
      cost: { type: Number },
      performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
   },
   { timestamps: true }
);

export default mongoose.model<IMaintenanceTask>('MaintenanceTask', MaintenanceTaskSchema);