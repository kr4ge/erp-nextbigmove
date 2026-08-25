import clsx from 'clsx';
import { PERFORMANCE_STATUS_LABELS, QC_STATUS_LABELS } from '../_constants/video-registry.constants';
import type { CreativePerformanceStatus, CreativeQcStatus } from '../_types/video-registry';

type Props =
  | { type: 'qc'; status: CreativeQcStatus }
  | { type: 'performance'; status: CreativePerformanceStatus };

const qcTone: Record<CreativeQcStatus, string> = {
  DRAFT: 'border-border bg-background-secondary text-muted',
  FOR_APPROVAL: 'border-warning/30 bg-warning-soft/60 text-warning',
  FOR_REVISION: 'border-destructive/30 bg-destructive-soft/40 text-destructive',
  REVISED: 'border-info/30 bg-info-soft text-info',
  FOR_POSTING: 'border-primary/30 bg-primary-soft text-primary-soft-foreground',
  POSTED: 'border-success/30 bg-success-soft/40 text-success',
  CANCELLED: 'border-border bg-background-secondary text-muted',
};

const performanceTone: Record<CreativePerformanceStatus, string> = {
  DRAFT: 'border-border bg-background-secondary text-muted',
  LIVE: 'border-info/30 bg-info-soft text-info',
  WINNER: 'border-success/30 bg-success-soft/40 text-success',
  FATIGUED: 'border-warning/30 bg-warning-soft/60 text-warning',
  RETIRED: 'border-border bg-background-secondary text-muted',
};

export function RegistryStatusPill(props: Props) {
  const label = props.type === 'qc'
    ? QC_STATUS_LABELS[props.status]
    : PERFORMANCE_STATUS_LABELS[props.status];
  const tone = props.type === 'qc' ? qcTone[props.status] : performanceTone[props.status];

  return (
    <span className={clsx('pill border font-semibold', tone)}>
      {label}
    </span>
  );
}
