import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
   projectId: mongoose.Types.ObjectId;
   name: string;
   parentId?: mongoose.Types.ObjectId;
   level: number;
   path: string;
   createdAt: Date;
   updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
   {
      projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
      name: { type: String, required: true },
      parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
      level: { type: Number, required: true },
      path: { type: String, required: true },
   },
   { timestamps: true }
);

// Index for fast queries
CategorySchema.index({ projectId: 1, path: 1 });

export default mongoose.model<ICategory>('Category', CategorySchema);