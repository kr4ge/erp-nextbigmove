export interface Profile {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  employeeId?: string | null;
  tenantId?: string | null;
  tenant?: { name?: string } | null;
  role?: string | null;
  defaultTeamId?: string | null;
}
