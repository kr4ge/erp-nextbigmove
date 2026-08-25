export type CreativeActor = {
  id?: string;
  userId?: string;
  tenantId?: string;
  role?: string;
  permissions?: string[];
};

export type CreativeAccessContext = {
  tenantId: string;
  userId: string;
  isSuperAdmin: boolean;
  permissions: Set<string>;
};
