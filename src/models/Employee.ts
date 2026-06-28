import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
   name: string;
   projectId: mongoose.Types.ObjectId;
   department?: string;
   phone?: string;
   isActive: boolean;
   createdAt: Date;
   updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
   {
      name: { type: String, required: true },
      projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
      department: { type: String },
      phone: { type: String },
      isActive: { type: Boolean, default: true },
   },
   { timestamps: true }
);

EmployeeSchema.index({ projectId: 1, name: 1 });

export default mongoose.model<IEmployee>('Employee', EmployeeSchema);
