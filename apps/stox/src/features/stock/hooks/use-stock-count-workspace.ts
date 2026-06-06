import { useCallback, useEffect, useState } from 'react';
import type { DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { ApiError } from '@/src/shared/services/http';
import {
  closeoutMobileStockCountSession,
  fetchMobileStockCountSession,
  fetchMobileStockCountSessions,
  reopenMobileStockCountSession,
  scanMobileStockCountUnit,
  startMobileStockCountSession,
  submitMobileStockCountSession,
} from '../services/stock-api';
import type {
  StockFilters,
  WmsMobileStockCountSessionDetail,
  WmsMobileStockCountSessionSummary,
} from '../types';
import { normalizeScannedCode } from './use-stock-execution';

type UseStockCountWorkspaceParams = {
  device: DeviceIdentity | null;
  filters: StockFilters;
  session: StoredSession;
};

export function useStockCountWorkspace({
  device,
  filters,
  session,
}: UseStockCountWorkspaceParams) {
  const [sessions, setSessions] = useState<WmsMobileStockCountSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<WmsMobileStockCountSessionDetail | null>(null);
  const [startCode, setStartCode] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [isClosingOut, setIsClosingOut] = useState(false);

  const loadSessions = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!device) {
      setError('Device is not ready.');
      setIsLoading(false);
      return;
    }

    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const response = await fetchMobileStockCountSessions({
        accessToken: session.accessToken,
        device,
        tenantId: filters.tenantId,
        warehouseId: filters.warehouseId,
      });

      setSessions(response.sessions);
      setError(null);

      if (!activeSession) {
        const openSession = response.sessions.find((item) => item.status === 'OPEN');

        if (openSession) {
          const detail = await fetchMobileStockCountSession({
            accessToken: session.accessToken,
            device,
            sessionId: openSession.id,
            tenantId: filters.tenantId,
          });
          setActiveSession(detail.session);
          setSessionNotes(detail.session.notes ?? '');
        }
      }
    } catch (requestError) {
      setError(resolveCountError(requestError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeSession, device, filters.tenantId, filters.warehouseId, session.accessToken]);

  useEffect(() => {
    void loadSessions('initial');
  }, [loadSessions]);

  const refresh = useCallback(async () => {
    await loadSessions('refresh');

    if (!device || !activeSession) {
      return;
    }

    try {
      const detail = await fetchMobileStockCountSession({
        accessToken: session.accessToken,
        device,
        sessionId: activeSession.id,
        tenantId: filters.tenantId,
      });

      setActiveSession(detail.session);
      setSessionNotes(detail.session.notes ?? '');
    } catch (requestError) {
      setError(resolveCountError(requestError));
    }
  }, [activeSession, device, filters.tenantId, loadSessions, session.accessToken]);

  const openSession = useCallback(async (sessionId: string) => {
    if (!device) {
      setError('Device is not ready.');
      return;
    }

    setIsRefreshing(true);

    try {
      const detail = await fetchMobileStockCountSession({
        accessToken: session.accessToken,
        device,
        sessionId,
        tenantId: filters.tenantId,
      });

      setActiveSession(detail.session);
      setSessionNotes(detail.session.notes ?? '');
      setMessage(null);
      setError(null);
    } catch (requestError) {
      setError(resolveCountError(requestError));
    } finally {
      setIsRefreshing(false);
    }
  }, [device, filters.tenantId, session.accessToken]);

  const startSession = useCallback(async () => {
    if (!device) {
      setError('Device is not ready.');
      return;
    }

    const targetCode = normalizeScannedCode(startCode);

    if (!targetCode) {
      setError('Scan or enter a bin code first.');
      return;
    }

    setIsStarting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await startMobileStockCountSession({
        accessToken: session.accessToken,
        device,
        tenantId: filters.tenantId,
        warehouseId: filters.warehouseId,
        targetCode,
        notes: sessionNotes.trim() || null,
      });

      setActiveSession(response.session);
      setSessions((current) => upsertSummary(current, response.session));
      setStartCode('');
      setScanCode('');
      setMessage(response.resumed ? 'Resumed an open cycle count for this bin.' : 'Cycle count started.');
    } catch (requestError) {
      setError(resolveCountError(requestError));
    } finally {
      setIsStarting(false);
    }
  }, [device, filters.tenantId, filters.warehouseId, session.accessToken, sessionNotes, startCode]);

  const scanUnit = useCallback(async () => {
    if (!device) {
      setError('Device is not ready.');
      return;
    }

    if (!activeSession) {
      setError('Start or open a cycle count session first.');
      return;
    }

    const code = normalizeScannedCode(scanCode);

    if (!code) {
      setError('Scan or enter a unit code.');
      return;
    }

    setIsScanning(true);
    setError(null);
    setMessage(null);

    try {
      const response = await scanMobileStockCountUnit({
        accessToken: session.accessToken,
        device,
        sessionId: activeSession.id,
        tenantId: filters.tenantId,
        code,
      });

      const nextSession = response.session;
      if (nextSession) {
        setActiveSession(nextSession);
        setSessions((current) => upsertSummary(current, nextSession));
      }
      setScanCode('');
      setMessage('Unit counted.');
    } catch (requestError) {
      setError(resolveCountError(requestError));
    } finally {
      setIsScanning(false);
    }
  }, [activeSession, device, filters.tenantId, scanCode, session.accessToken]);

  const submitSession = useCallback(async () => {
    if (!device) {
      setError('Device is not ready.');
      return;
    }

    if (!activeSession) {
      setError('Start or open a cycle count session first.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await submitMobileStockCountSession({
        accessToken: session.accessToken,
        device,
        sessionId: activeSession.id,
        tenantId: filters.tenantId,
        notes: sessionNotes.trim() || null,
      });

      const nextSession = response.session;
      if (nextSession) {
        setActiveSession(nextSession);
        setSessions((current) => upsertSummary(current, nextSession));
        setSessionNotes(nextSession.notes ?? '');
      }
      setMessage('Cycle count submitted. Review variances before making stock adjustments.');
    } catch (requestError) {
      setError(resolveCountError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }, [activeSession, device, filters.tenantId, session.accessToken, sessionNotes]);

  const reopenSession = useCallback(async () => {
    if (!device) {
      setError('Device is not ready.');
      return;
    }

    if (!activeSession) {
      setError('Open a cycle count session first.');
      return;
    }

    setIsReopening(true);
    setError(null);
    setMessage(null);

    try {
      const response = await reopenMobileStockCountSession({
        accessToken: session.accessToken,
        device,
        sessionId: activeSession.id,
        tenantId: filters.tenantId,
        notes: sessionNotes.trim() || null,
      });

      const nextSession = response.session;
      if (nextSession) {
        setActiveSession(nextSession);
        setSessions((current) => upsertSummary(current, nextSession));
        setSessionNotes(nextSession.notes ?? '');
      }
      setMessage('Cycle count reopened for recount.');
    } catch (requestError) {
      setError(resolveCountError(requestError));
    } finally {
      setIsReopening(false);
    }
  }, [activeSession, device, filters.tenantId, session.accessToken, sessionNotes]);

  const closeoutSession = useCallback(async () => {
    if (!device) {
      setError('Device is not ready.');
      return;
    }

    if (!activeSession) {
      setError('Open a cycle count session first.');
      return;
    }

    setIsClosingOut(true);
    setError(null);
    setMessage(null);

    try {
      const response = await closeoutMobileStockCountSession({
        accessToken: session.accessToken,
        device,
        sessionId: activeSession.id,
        tenantId: filters.tenantId,
        notes: sessionNotes.trim() || null,
      });

      const nextSession = response.session;
      if (nextSession) {
        setActiveSession(nextSession);
        setSessions((current) => upsertSummary(current, nextSession));
        setSessionNotes(nextSession.notes ?? '');
      }
      setMessage('Cycle count closed out by supervisor review.');
    } catch (requestError) {
      setError(resolveCountError(requestError));
    } finally {
      setIsClosingOut(false);
    }
  }, [activeSession, device, filters.tenantId, session.accessToken, sessionNotes]);

  const clearActiveSession = useCallback(() => {
    setActiveSession(null);
    setScanCode('');
    setMessage(null);
    setError(null);
  }, []);

  return {
    activeSession,
    clearActiveSession,
    error,
    isLoading,
    isRefreshing,
    isReopening,
    isScanning,
    isClosingOut,
    isStarting,
    isSubmitting,
    message,
    openSession,
    refresh,
    reopenSession,
    scanCode,
    sessionNotes,
    sessions,
    setScanCode: (value: string) => setScanCode(normalizeScannedCode(value)),
    setSessionNotes,
    setStartCode: (value: string) => setStartCode(normalizeScannedCode(value)),
    startCode,
    startSession,
    closeoutSession,
    submitSession,
    scanUnit,
  };
}

function resolveCountError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Cycle count action failed.';
}

function upsertSummary(
  sessions: WmsMobileStockCountSessionSummary[],
  nextSession: WmsMobileStockCountSessionDetail,
) {
  const nextSummary: WmsMobileStockCountSessionSummary = {
    id: nextSession.id,
    status: nextSession.status,
    statusLabel: nextSession.statusLabel,
    warehouse: nextSession.warehouse,
    location: nextSession.location,
    notes: nextSession.notes,
    startedAt: nextSession.startedAt,
    submittedAt: nextSession.submittedAt,
    closedAt: nextSession.closedAt,
    startedBy: nextSession.startedBy,
    submittedBy: nextSession.submittedBy,
    closedBy: nextSession.closedBy,
    summary: nextSession.summary,
  };

  const existing = sessions.find((session) => session.id === nextSummary.id);

  if (!existing) {
    return [nextSummary, ...sessions];
  }

  return sessions.map((session) => (session.id === nextSummary.id ? nextSummary : session));
}
