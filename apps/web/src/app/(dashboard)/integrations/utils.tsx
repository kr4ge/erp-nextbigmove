import type { IntegrationProvider, IntegrationStatus } from './types';
import { ReactNode } from 'react';

export const formatIntegrationDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const getStatusBadgeClasses = (status: IntegrationStatus) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-400/10 text-green-400 ring-green-400/30';
    case 'PENDING':
      return 'bg-yellow-400/10 text-yellow-400 ring-yellow-400/30';
    case 'ERROR':
      return 'bg-red-400/10 text-red-400 ring-red-400/30';
    case 'DISABLED':
    default:
      return 'bg-gray-400/10 text-gray-400 ring-gray-400/30';
  }
};

export const getProviderName = (provider: IntegrationProvider) => {
  switch (provider) {
    case 'META_ADS':
      return 'Meta Ads';
    case 'PANCAKE_POS':
      return 'Pancake POS';
    default:
      return provider;
  }
};

export const getProviderIcon = (provider: IntegrationProvider): ReactNode => {
  switch (provider) {
    case 'META_ADS':
      return (
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'PANCAKE_POS':
      return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      );
    default:
      return null;
  }
};
