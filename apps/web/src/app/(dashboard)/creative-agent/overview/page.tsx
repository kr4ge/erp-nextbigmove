import { Bot, Library } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';

export default function CreativeAgentOverviewPage() {
  return (
    <div>
      <PageHeader title="Creative Agent" description="A command center for creative production and performance intelligence." breadcrumbs="Creative Agent / Overview" />
      <section className="panel p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Bot className="h-7 w-7" /></span>
        <h2 className="mt-5 text-xl font-semibold text-foreground">Overview is planned next</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">The overview will be designed after the Video Registry workflow is approved and its backend contracts are finalized.</p>
        <Link href="/creative-agent/video-registry" className="btn btn-md btn-primary-soft btn-icon mt-6 inline-flex items-center gap-2">
          <Library className="h-4 w-4" /> Review Video Registry
        </Link>
      </section>
    </div>
  );
}
