import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { ApiError } from '@/src/shared/services/http';
import {
  clearStoredSession,
  getOrCreateDeviceIdentity,
  readStoredSession,
  writeStoredSession,
} from '@/src/shared/storage/session-storage';
import {
  fetchBootstrapRequest,
  loginRequest,
  logoutRequest,
  refreshSessionRequest,
} from './services/auth-api';
import type { BootstrapResponse, DeviceIdentity, StoredSession } from './types';

type SessionContextValue = {
  device: DeviceIdentity | null;
  session: StoredSession | null;
  bootstrap: BootstrapResponse | null;
  isHydrating: boolean;
  isSubmitting: boolean;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [device, setDevice] = useState<DeviceIdentity | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const restoreSession = useCallback(async () => {
    setIsHydrating(true);
    const identity = await getOrCreateDeviceIdentity();
    setDevice(identity);

    const stored = await readStoredSession();
    if (!stored) {
      setSession(null);
      setBootstrap(null);
      setIsHydrating(false);
      return;
    }

    try {
      const next = await ensureBootstrap(stored, identity);
      setSession(next.session);
      setBootstrap(next.bootstrap);
    } catch {
      await clearStoredSession();
      setSession(null);
      setBootstrap(null);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const identity = device || (await getOrCreateDeviceIdentity());
      setDevice(identity);
      setIsSubmitting(true);

      try {
        const response = await loginRequest({
          email,
          password,
          device: identity,
        });

        const nextSession: StoredSession = {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          sessionId: response.sessionId ?? null,
          user: response.user,
          tenant: response.tenant,
        };

        const next = await ensureBootstrap(nextSession, identity);
        await writeStoredSession(next.session);
        setSession(next.session);
        setBootstrap(next.bootstrap);
      } finally {
        setIsSubmitting(false);
      }
    },
    [device],
  );

  const signOut = useCallback(async () => {
    if (!device || !session) {
      await clearStoredSession();
      setSession(null);
      setBootstrap(null);
      return;
    }

    setIsSubmitting(true);
    try {
      await logoutRequest({
        accessToken: session.accessToken,
        device,
      });
    } finally {
      await clearStoredSession();
      setSession(null);
      setBootstrap(null);
      setIsSubmitting(false);
    }
  }, [device, session]);

  const refreshBootstrap = useCallback(async () => {
    if (!device || !session) {
      return;
    }

    setIsSubmitting(true);
    try {
      const next = await ensureBootstrap(session, device);
      await writeStoredSession(next.session);
      setSession(next.session);
      setBootstrap(next.bootstrap);
    } finally {
      setIsSubmitting(false);
    }
  }, [device, session]);

  const value = useMemo<SessionContextValue>(
    () => ({
      device,
      session,
      bootstrap,
      isHydrating,
      isSubmitting,
      signIn,
      signOut,
      refreshBootstrap,
    }),
    [bootstrap, device, isHydrating, isSubmitting, refreshBootstrap, session, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }

  return context;
}

async function ensureBootstrap(session: StoredSession, device: DeviceIdentity) {
  try {
    const bootstrap = await fetchBootstrapRequest({
      accessToken: session.accessToken,
      device,
    });

    return {
      session,
      bootstrap,
    };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const refreshed = await refreshSessionRequest({
      refreshToken: session.refreshToken,
      device,
    });

    const refreshedSession: StoredSession = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      sessionId: refreshed.sessionId ?? session.sessionId,
      user: refreshed.user,
      tenant: refreshed.tenant,
    };

    const bootstrap = await fetchBootstrapRequest({
      accessToken: refreshedSession.accessToken,
      device,
    });

    return {
      session: refreshedSession,
      bootstrap,
    };
  }
}
