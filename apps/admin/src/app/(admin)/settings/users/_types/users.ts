export type WmsUserRole = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
};

export type WmsUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string | null;
  assignedRole: WmsUserRole | null;
};

export type WmsUserForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'SUSPENDED';
  roleId: string;
};
