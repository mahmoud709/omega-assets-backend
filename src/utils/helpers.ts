// Helper functions
// TODO: Implement utility helper functions

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const hashPassword = (password: string): string => {
  // TODO: Implement password hashing
  return password;
};

export const verifyPassword = (password: string, hash: string): boolean => {
  // TODO: Implement password verification
  return password === hash;
};

export const formatDate = (date: Date): string => {
  return date.toISOString();
};
