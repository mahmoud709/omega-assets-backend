import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
   userId: mongoose.Types.ObjectId;
   type: 'custody_expiry' | 'maintenance_due' | 'system';
   message: string;
   isRead: boolean;
   link?: string;
   createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
   {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      type: { type: String, enum: ['custody_expiry', 'maintenance_due', 'system'], required: true },
      message: { type: String, required: true },
      isRead: { type: Boolean, default: false },
      link: { type: String },
   },
   { timestamps: true }
);

export default mongoose.model<INotification>('Notification', NotificationSchema);