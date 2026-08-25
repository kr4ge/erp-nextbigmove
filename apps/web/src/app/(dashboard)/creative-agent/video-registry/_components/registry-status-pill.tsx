import clsx from 'clsx';
import { PERFORMANCE_STATUS_LABELS, REVISION_STATE_LABELS } from '../_constants/video-registry.constants';
import type { CreativePerformanceStatus, CreativeRevisionState } from '../_types/video-registry';

type Props =
  | { type: 'revision'; status: CreativeRevisionState }
  | { type: 'performance'; status: CreativePerformanceStatus };

/**
 * NONE is the resting state and carries no information, so it is never drawn —
 * callers only render a revision pill when there is something to say.
 */
const revisionTone: Record<CreativeRevisionState, string> = {
  NONE: 'border-border bg-background-secondary text-muted',
  NEEDS_REVISION: 'border-warning/30 bg-warning-soft/60 text-warning',
  RESOLVED: 'border-success/30 bg-success-soft/40 text-success',
};

const performanceTone: Record<CreativePerformanceStatus, string> = {
  DRAFT: 'border-border bg-background-secondary text-muted',
  LIVE: 'border-info/30 bg-info-soft text-info',
  WINNER: 'border-success/30 bg-success-soft/40 text-success',
  FATIGUED: 'border-warning/30 bg-warning-soft/60 text-warning',
  RETIRED: 'border-border bg-background-secondary text-muted',
};

export function RegistryStatusPill(props: Props) {
  const label = props.type === 'revision'
    ? REVISION_STATE_LABELS[props.status]
    : PERFORMANCE_STATUS_LABELS[props.status];
  const tone = props.type === 'revision' ? revisionTone[props.status] : performanceTone[props.status];

  return (
    <span className={clsx('pill border font-semibold', tone)}>
      {label}
    </span>
  );
}
