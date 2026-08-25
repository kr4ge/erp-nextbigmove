import { VideoRegistryScreen } from '../creative-agent/video-registry/_components/video-registry-screen';

export default function VideoRegistryPage({ searchParams }: { searchParams?: { query?: string } }) {
  return <VideoRegistryScreen initialQuery={searchParams?.query} />;
}
