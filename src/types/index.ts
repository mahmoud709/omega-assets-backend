// Type definitions
export interface IUser {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProject {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAsset {
  id: string;
  name: string;
  assetNumber: string;
  description: string;
  category: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// TODO: Add more type definitions
