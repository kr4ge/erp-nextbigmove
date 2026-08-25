import { CreativeAssetsScreen } from '../creative-agent/assets/_components/creative-assets-screen';

export default function AssetsPage({ searchParams }: {
  searchParams?: { query?: string; creative?: string; qcStatus?: string; queue?: string };
}) {
  return (
    <CreativeAssetsScreen
      initialQuery={searchParams?.query}
      initialCreativeId={searchParams?.creative}
      initialQcStatus={searchParams?.qcStatus}
      initialQueue={searchParams?.queue}
    />
  );
}
