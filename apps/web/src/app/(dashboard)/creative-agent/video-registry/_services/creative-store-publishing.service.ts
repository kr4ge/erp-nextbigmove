import axios from 'axios';
import apiClient from '@/lib/api-client';

export type ProductDestination = {
  posCustomId: string;
  posProductName: string | null;
  pixelId: string;
  landingPageUrl: string;
  displayLink: string | null;
};

export type PublishingProfileValues = {
  metaAdAccountId: string | null;
  facebookPageId: string | null;
  facebookPageName: string | null;
  instagramAccountId: string | null;
  instagramUsername: string | null;
  defaultDailyBudget: number | null;
  countries: string[];
  timezone: string;
};

export type PublishingProfile = {
  storeConfigId: string;
  storeName: string;
  codePrefix: string;
  canEdit: boolean;
  profile: (PublishingProfileValues & { updatedAt: string | null; updatedBy: string | null }) | null;
  products: ProductDestination[];
  adAccounts: Array<{ accountId: string; name: string; currency: string | null; timezone: string | null }>;
  storeProducts: Array<{ customId: string; name: string; enrolledCreatives: number }>;
  missing: string[];
};

export type MetaOptions = {
  pages: Array<{ id: string; name: string; instagramAccountId: string | null; instagramUsername: string | null }>;
  pixels: Array<{ id: string; name: string }>;
  error?: string;
};

function publishingError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return new Error(Array.isArray(message) ? message.join(', ') : message || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export async function fetchPublishingProfile(storeConfigId: string): Promise<PublishingProfile> {
  try {
    const { data } = await apiClient.get<PublishingProfile>(`/creative-agent/stores/${storeConfigId}/publishing`);
    return data;
  } catch (error) {
    throw publishingError(error, 'Unable to load the Meta publishing profile.');
  }
}

export async function savePublishingProfile(
  storeConfigId: string,
  values: PublishingProfileValues & { products: ProductDestination[] },
): Promise<PublishingProfile> {
  try {
    const { data } = await apiClient.put<PublishingProfile>(`/creative-agent/stores/${storeConfigId}/publishing`, values);
    return data;
  } catch (error) {
    throw publishingError(error, 'Unable to save the Meta publishing profile.');
  }
}

/** Pages and pixels the tenant's token can see. Errors come back as text so the form still works by hand. */
export async function fetchMetaOptions(storeConfigId: string, adAccountId?: string | null): Promise<MetaOptions> {
  try {
    const { data } = await apiClient.get<MetaOptions>(`/creative-agent/stores/${storeConfigId}/publishing/meta-options`, {
      params: { adAccountId: adAccountId || undefined },
    });
    return data;
  } catch (error) {
    return { pages: [], pixels: [], error: publishingError(error, 'Unable to reach Meta for pages and pixels.').message };
  }
}
