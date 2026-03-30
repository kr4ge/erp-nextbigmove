import type { StoreCard } from '../_types/store-list';

export const STORE_PAGE_SIZE = 12;

export function getStoreInitials(title: string) {
  if (!title) return 'S';
  return title
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function filterStores(stores: StoreCard[], searchTerm: string) {
  if (!searchTerm) return stores;
  const term = searchTerm.toLowerCase();
  return stores.filter((store) => {
    const name = store.name?.toLowerCase() || '';
    const shopName = store.shopName?.toLowerCase() || '';
    const shopId = store.shopId?.toLowerCase() || '';
    const description = store.description?.toLowerCase() || '';
    return (
      name.includes(term) ||
      shopName.includes(term) ||
      shopId.includes(term) ||
      description.includes(term)
    );
  });
}
