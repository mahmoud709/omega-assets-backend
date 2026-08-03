import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
   name: string;
   projectId: mongoose.Types.ObjectId;
   projectIds?: mongoose.Types.ObjectId[];
   department?: string;
   phone?: string;
   isActive: boolean;
   isOffice?: boolean;
   members?: mongoose.Types.ObjectId[];
   createdAt: Date;
   updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
   {
      name: { type: String, required: true },
      projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
      projectIds: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
      department: { type: String },
      phone: { type: String },
      isActive: { type: Boolean, default: true },
      isOffice: { type: Boolean, default: false },
      members: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
   },
   { timestamps: true }
);

EmployeeSchema.index({ projectId: 1, name: 1 });
EmployeeSchema.index({ projectIds: 1 });

export default mongoose.model<IEmployee>('Employee', EmployeeSchema);
