import mongoose, { Schema, Document } from 'mongoose';

export interface ICustodyLog extends Document {
   assetId: mongoose.Types.ObjectId;
   fromProjectId?: mongoose.Types.ObjectId;
   toProjectId?: mongoose.Types.ObjectId;
   fromUserId?: mongoose.Types.ObjectId;
   toUserId?: mongoose.Types.ObjectId;
   fromUserName?: string;
   toUserName?: string;
   transferredAt: Date;
   notes?: string;
   createdAt: Date;
}

const CustodyLogSchema = new Schema<ICustodyLog>(
   {
      assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
      fromProjectId: { type: Schema.Types.ObjectId, ref: 'Project' },
      toProjectId: { type: Schema.Types.ObjectId, ref: 'Project' },
      fromUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      toUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      fromUserName: { type: String },
      toUserName: { type: String },
      transferredAt: { type: Date, default: Date.now },
      notes: { type: String },
   },
   { timestamps: true }
);

CustodyLogSchema.index({ assetId: 1, transferredAt: -1 });

export default mongoose.model<ICustodyLog>('CustodyLog', CustodyLogSchema);