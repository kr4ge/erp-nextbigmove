import { AdvertisingPerformanceScreen } from '../creative-agent/advertising/performance/_components/advertising-performance-screen';

export default function PerformancePage({ searchParams }: {
  searchParams?: {
    group?: string;
    linkStatus?: string;
    verdict?: string;
    adId?: string;
    creativeId?: string;
    campaignId?: string;
  };
}) {
  return (
    <AdvertisingPerformanceScreen
      initialFilters={{
        group: searchParams?.group,
        linkStatus: searchParams?.linkStatus,
        verdict: searchParams?.verdict,
        adId: searchParams?.adId,
        creativeId: searchParams?.creativeId,
        campaignId: searchParams?.campaignId,
      }}
    />
  );
}
