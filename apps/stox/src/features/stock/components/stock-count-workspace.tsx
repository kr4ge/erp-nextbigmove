import { useEffect, useMemo, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { tokens } from '@/src/shared/theme/tokens';
import {
  SectionLabel,
  TaskHeaderIconButton,
} from '@/src/features/home/components/stox-primitives';
import { canSuperviseInventoryCounts } from '@/src/features/home/rbac';
import { useStockCountWorkspace } from '../hooks/use-stock-count-workspace';
import { StockRecordCard } from './stock-record-card';
import type { StockFilters, WmsMobileStockCountEntry } from '../types';
import { formatStockCount, formatStockDate, joinStockMeta } from '../utils/stock-formatters';

type StockCountWorkspaceProps = {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  filters: StockFilters;
  session: StoredSession;
};

const ENTRY_SECTION_LIMIT = 12;

export function StockCountWorkspace({
  bootstrap,
  device,
  filters,
  session,
}: StockCountWorkspaceProps) {
  const workspace = useStockCountWorkspace({
    device,
    filters,
    session,
  });
  const scanInputRef = useRef<TextInput>(null);
  const canCloseout = canSuperviseInventoryCounts(bootstrap);

  useEffect(() => {
    if (workspace.activeSession?.status === 'OPEN') {
      const timer = setTimeout(() => {
        scanInputRef.current?.focus();
      }, 140);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [workspace.activeSession?.id, workspace.activeSession?.status]);

  const groupedEntries = useMemo(() => {
    const entries = workspace.activeSession?.entries ?? [];

    return {
      counted: entries.filter((entry) => entry.status === 'COUNTED'),
      missing: entries.filter((entry) => entry.status === 'MISSING'),
      pending: entries.filter((entry) => entry.status === 'PENDING'),
      unexpected: entries.filter((entry) => entry.status === 'UNEXPECTED'),
    };
  }, [workspace.activeSession?.entries]);

  return (
    <View style={styles.root}>
      <View style={styles.queueHeader}>
        <TaskHeaderIconButton
          icon="refresh-cw"
          loading={workspace.isRefreshing}
          onPress={workspace.refresh}
        />
        <View style={styles.queueHeaderCopy}>
          <Text style={styles.queueHeaderTitle}>Cycle Count</Text>
        </View>
        <View style={styles.queueHeaderBadge}>
          <Text style={styles.queueHeaderBadgeText}>
            {workspace.activeSession ? workspace.activeSession.statusLabel : `${formatStockCount(workspace.sessions.length)} recent`}
          </Text>
        </View>
      </View>

      {workspace.error ? (
        <SurfaceCard style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Cycle count needs attention</Text>
          <Text style={styles.noticeCopy}>{workspace.error}</Text>
        </SurfaceCard>
      ) : null}

      {workspace.message ? (
        <SurfaceCard style={styles.successCard}>
          <Text style={styles.noticeTitle}>Inventory update</Text>
          <Text style={styles.noticeCopy}>{workspace.message}</Text>
        </SurfaceCard>
      ) : null}

      {!workspace.activeSession ? (
        <>
          <SurfaceCard style={styles.panelCard}>
            <Text style={styles.panelTitle}>Start count</Text>

            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              blurOnSubmit={false}
              caretHidden
              contextMenuHidden
              placeholder="Scan bin"
              placeholderTextColor={tokens.colors.inkSoft}
              returnKeyType="go"
              selectTextOnFocus={false}
              showSoftInputOnFocus={false}
              style={styles.input}
              value={workspace.startCode}
              onChangeText={workspace.setStartCode}
              onSubmitEditing={() => {
                void workspace.startSession();
              }}
            />

            <TextInput
              multiline
              numberOfLines={3}
              placeholder="Note (optional)"
              placeholderTextColor={tokens.colors.inkSoft}
              style={[styles.input, styles.textArea]}
              value={workspace.sessionNotes}
              onChangeText={workspace.setSessionNotes}
            />

            <PrimaryButton
              label={workspace.isStarting ? 'Starting count…' : 'Start cycle count'}
              loading={workspace.isStarting}
              onPress={workspace.startSession}
            />
          </SurfaceCard>

          <SectionLabel title="Recent sessions" trailing={workspace.sessions.length > 0 ? formatStockCount(workspace.sessions.length) : undefined} />

          {workspace.isLoading ? (
            <SurfaceCard style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Loading cycle counts</Text>
            </SurfaceCard>
          ) : workspace.sessions.length === 0 ? (
            <SurfaceCard style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>No counts</Text>
            </SurfaceCard>
          ) : (
            <View style={styles.entryList}>
              {workspace.sessions.map((sessionItem) => (
                <StockRecordCard
                  key={sessionItem.id}
                  badge={sessionItem.statusLabel}
                  icon="clipboard"
                  title={sessionItem.location.code}
                  subtitle={joinStockMeta([
                    sessionItem.location.name,
                    sessionItem.warehouse.code,
                  ])}
                  meta={joinStockMeta([
                    `${formatStockCount(sessionItem.summary.countedUnits)} counted`,
                    `${formatStockCount(sessionItem.summary.varianceUnits)} variance`,
                    formatStockDate(sessionItem.startedAt),
                  ])}
                  onPress={() => {
                    void workspace.openSession(sessionItem.id);
                  }}
                />
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <SurfaceCard style={styles.panelCard}>
            <SectionLabel
              title={workspace.activeSession.location.code}
              trailing={workspace.activeSession.location.label}
            />
            <Text style={styles.noticeCopy}>
              {joinStockMeta([
                workspace.activeSession.location.name,
                workspace.activeSession.startedBy?.name ?? 'Unknown counter',
                `Started ${formatStockDate(workspace.activeSession.startedAt)}`,
              ])}
            </Text>
            {workspace.activeSession.notes ? (
              <Text style={styles.sessionNote}>{workspace.activeSession.notes}</Text>
            ) : null}
          </SurfaceCard>

          <View style={styles.summaryGrid}>
            <CountStatPill
              label="Counted"
              value={formatStockCount(workspace.activeSession.summary.countedUnits)}
            />
            <CountStatPill
              label="Pending"
              value={formatStockCount(workspace.activeSession.summary.pendingUnits)}
            />
            <CountStatPill
              label="Missing"
              value={formatStockCount(workspace.activeSession.summary.missingUnits)}
            />
            <CountStatPill
              label="Extra"
              value={formatStockCount(workspace.activeSession.summary.unexpectedUnits)}
            />
          </View>

          {workspace.activeSession.status === 'OPEN' ? (
            <SurfaceCard style={styles.panelCard}>
              <Text style={styles.panelTitle}>
                Scan unit · {formatStockCount(workspace.activeSession.summary.expectedUnits)}
              </Text>
              <TextInput
                ref={scanInputRef}
                autoCapitalize="characters"
                autoCorrect={false}
                blurOnSubmit={false}
                caretHidden
                contextMenuHidden
                placeholder="Scan unit"
                placeholderTextColor={tokens.colors.inkSoft}
                returnKeyType="done"
                selectTextOnFocus={false}
                showSoftInputOnFocus={false}
                style={styles.input}
                value={workspace.scanCode}
                onChangeText={workspace.setScanCode}
                onSubmitEditing={() => {
                  void workspace.scanUnit();
                }}
              />

              <View style={styles.actionRow}>
                <PrimaryButton
                  label={workspace.isScanning ? 'Counting…' : 'Count'}
                  loading={workspace.isScanning}
                  onPress={workspace.scanUnit}
                  style={styles.actionButton}
                />
                <PrimaryButton
                  label={workspace.isSubmitting ? 'Submitting…' : 'Submit'}
                  loading={workspace.isSubmitting}
                  variant="secondary"
                  onPress={workspace.submitSession}
                  style={styles.actionButton}
                />
              </View>
            </SurfaceCard>
          ) : workspace.activeSession.status === 'SUBMITTED' ? (
            <SurfaceCard style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Awaiting review</Text>
              <Text style={styles.noticeCopy}>Locked.</Text>
            </SurfaceCard>
          ) : (
            <SurfaceCard style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Closed</Text>
            </SurfaceCard>
          )}

          <View style={styles.actionRow}>
            {canCloseout && workspace.activeSession.status !== 'OPEN' ? (
              <PrimaryButton
                label={workspace.isReopening ? 'Reopening…' : 'Reopen'}
                loading={workspace.isReopening}
                variant="secondary"
                onPress={workspace.reopenSession}
                style={styles.actionButton}
              />
            ) : null}
            {canCloseout && workspace.activeSession.status === 'SUBMITTED' ? (
              <PrimaryButton
                label={workspace.isClosingOut ? 'Closing…' : 'Close'}
                loading={workspace.isClosingOut}
                onPress={workspace.closeoutSession}
                style={styles.actionButton}
              />
            ) : null}
            <PrimaryButton
              label="Another count"
              variant="secondary"
              onPress={workspace.clearActiveSession}
              style={styles.actionButton}
            />
          </View>

          <EntrySection
            icon="clock"
            title="Pending units"
            entries={groupedEntries.pending}
            emptyCopy="Done."
          />
          <EntrySection
            icon="check-circle"
            title="Counted units"
            entries={groupedEntries.counted}
            emptyCopy="None counted."
          />
          <EntrySection
            icon="alert-triangle"
            title="Missing units"
            entries={groupedEntries.missing}
            emptyCopy="None."
          />
          <EntrySection
            icon="plus-circle"
            title="Unexpected units"
            entries={groupedEntries.unexpected}
            emptyCopy="None."
          />
        </>
      )}
    </View>
  );
}

function CountStatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.countStatPill}>
      <Text style={styles.countStatValue}>{value}</Text>
      <Text style={styles.countStatLabel}>{label}</Text>
    </View>
  );
}

function EntrySection({
  entries,
  emptyCopy,
  icon,
  title,
}: {
  entries: WmsMobileStockCountEntry[];
  emptyCopy: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
}) {
  const visibleEntries = entries.slice(0, ENTRY_SECTION_LIMIT);
  const hiddenCount = Math.max(entries.length - visibleEntries.length, 0);

  return (
    <View style={styles.entrySection}>
      <SectionLabel title={title} trailing={formatStockCount(entries.length)} />

      {entries.length === 0 ? (
        <SurfaceCard style={styles.noticeCard}>
          <Text style={styles.noticeCopy}>{emptyCopy}</Text>
        </SurfaceCard>
      ) : (
        <View style={styles.entryList}>
          {visibleEntries.map((entry) => (
            <StockRecordCard
              key={entry.id}
              badge={entry.statusLabel}
              icon={icon}
              title={entry.unitCode}
              subtitle={joinStockMeta([
                entry.productName,
                entry.productCustomId ?? null,
              ])}
              meta={joinStockMeta([
                entry.unitBarcode,
                entry.scannedAt ? `Scanned ${formatStockDate(entry.scannedAt)}` : null,
              ])}
            />
          ))}
          {hiddenCount > 0 ? (
            <SurfaceCard style={styles.noticeCard}>
              <Text style={styles.noticeCopy}>{formatStockCount(hiddenCount)} more</Text>
            </SurfaceCard>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: tokens.spacing.lg,
  },
  queueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  queueHeaderCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  queueHeaderTitle: {
    color: tokens.colors.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  queueHeaderBadge: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 86,
    paddingHorizontal: tokens.spacing.md,
  },
  queueHeaderBadgeText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  panelCard: {
    gap: tokens.spacing.sm,
  },
  panelTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  noticeCard: {
    gap: tokens.spacing.xs,
  },
  successCard: {
    gap: tokens.spacing.xs,
    borderColor: '#BDE7D1',
    backgroundColor: '#F2FCF6',
  },
  noticeTitle: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  noticeCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  sessionNote: {
    color: tokens.colors.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    minHeight: 56,
    paddingHorizontal: tokens.spacing.md,
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 96,
    paddingTop: tokens.spacing.md,
    textAlignVertical: 'top',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  countStatPill: {
    alignItems: 'center',
    backgroundColor: '#EEE9FF',
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    minWidth: 74,
    paddingHorizontal: 10,
  },
  countStatValue: {
    color: '#24232D',
    fontSize: 16,
    fontWeight: '900',
  },
  countStatLabel: {
    color: '#6F5BCB',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: 160,
  },
  entrySection: {
    gap: tokens.spacing.sm,
  },
  entryList: {
    gap: tokens.spacing.sm,
  },
});
