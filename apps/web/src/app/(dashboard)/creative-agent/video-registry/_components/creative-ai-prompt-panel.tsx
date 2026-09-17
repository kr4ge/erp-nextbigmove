'use client';

import { BookOpen, Gauge, Info } from 'lucide-react';

/**
 * How this creative will be judged, shown beside the run controls.
 *
 * Which of the two prompts runs is decided from the creative's own data, not
 * chosen here, so this explains the rule rather than offering a switch. The
 * prompt text itself is edited in Settings, AI.
 */
export function CreativeAiPromptPanel() {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Info className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-semibold">How this is judged</span>
      </div>
      <div className="space-y-2.5">
        <Mode
          icon={<Gauge className="h-3.5 w-3.5" />}
          title="Prompt 1, if it has run"
          body="Linked to Meta ads with spend and impressions: judged on what it earned. Returns scale, watch or kill, and the lesson for the knowledge base."
        />
        <Mode
          icon={<BookOpen className="h-3.5 w-3.5" />}
          title="Prompt 2, if it has not"
          body="Reviewed on how it is made, checked for repeats, and compared with this store's knowledge base. Returns approve, revise or reject."
        />
      </div>
      <p className="mt-3 border-t border-border pt-2.5 text-xs leading-relaxed text-muted">
        Both prompts are editable in Settings, AI. Each analysis records the prompt version that judged it.
      </p>
    </div>
  );
}

function Mode({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{body}</span>
      </span>
    </div>
  );
}
