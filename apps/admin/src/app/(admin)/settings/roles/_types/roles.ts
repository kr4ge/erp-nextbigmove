export type WmsRole = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: string[];
};

export type WmsPermission = {
  id: string;
  key: string;
  description?: string | null;
};
