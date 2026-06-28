import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
   name: string;
   location: string;
   description?: string;
   startDate?: Date;
   endDate?: Date;
   isActive: boolean;
   createdBy: mongoose.Types.ObjectId;
   createdAt: Date;
   updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
   {
      name: { type: String, required: true },
      location: { type: String, required: true },
      description: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      isActive: { type: Boolean, default: true },
      createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
   },
   { timestamps: true }
);

export default mongoose.model<IProject>('Project', ProjectSchema);