export interface StoreCard {
  id: string;
  name: string;
  shopName?: string;
  shopAvatarUrl?: string;
  description?: string;
  shopId?: string;
  status?: string;
  enabled?: boolean;
  teamId?: string | null;
}
