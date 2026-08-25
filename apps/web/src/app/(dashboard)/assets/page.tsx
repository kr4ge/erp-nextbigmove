import { CreativeAssetsScreen } from '../creative-agent/assets/_components/creative-assets-screen';

export default function AssetsPage({ searchParams }: {
  searchParams?: { query?: string; creative?: string; revisionState?: string; queue?: string };
}) {
  return (
    <CreativeAssetsScreen
      initialQuery={searchParams?.query}
      initialCreativeId={searchParams?.creative}
      initialRevisionState={searchParams?.revisionState}
      initialQueue={searchParams?.queue}
    />
  );
}
