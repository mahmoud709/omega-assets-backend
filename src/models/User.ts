import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
   email: string;
   passwordHash: string;
   fullName: string;
   role: 'admin' | 'site_manager' | 'viewer';
   siteId?: mongoose.Types.ObjectId;
   createdAt: Date;
   updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
   {
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      fullName: { type: String, required: true },
      role: {
         type: String,
         enum: ['admin', 'site_manager', 'viewer'],
         default: 'viewer',
      },
      siteId: { type: Schema.Types.ObjectId, ref: 'Project' }, // if tied to a project
   },
   { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);