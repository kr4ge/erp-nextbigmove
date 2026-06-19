'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingCard } from '@/components/ui/feedback';
import { useOrdersPermissions } from './_hooks/use-orders-permissions';

export default function OrdersPage() {
  const router = useRouter();
  const { isLoading, canViewOrdersSummary, canViewOrderConfirmation } = useOrdersPermissions();

  useEffect(() => {
    if (isLoading) return;

    if (canViewOrdersSummary) {
      router.replace('/orders/summary');
      return;
    }

    if (canViewOrderConfirmation) {
      router.replace('/orders/confirmation');
      return;
    }

    router.replace('/dashboard');
  }, [canViewOrderConfirmation, canViewOrdersSummary, isLoading, router]);

  return <LoadingCard label="Loading orders..." />;
}
