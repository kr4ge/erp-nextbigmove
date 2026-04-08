import { redirect } from 'next/navigation';

export default function WarehousesRedirectPage() {
  redirect('/inventory/warehouses');
}
