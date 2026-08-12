import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import { ApiError } from '@/src/shared/services/http';
import { fetchMobilePackingProofs, uploadMobilePackingProof } from '../services/packing-api';
import type { WmsPackingProof, WmsPackingProofFile } from '../types';

type UsePackingProofParams = {
  device: DeviceIdentity | null;
  enabled: boolean;
  orderId: string | null;
  session: StoredSession;
};

export function usePackingProof({ device, enabled, orderId, session }: UsePackingProofParams) {
  const [proofs, setProofs] = useState<WmsPackingProof[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const requestVersionRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled || !orderId || !device) {
      setProofs([]);
      setError(null);
      return false;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchMobilePackingProofs({
        accessToken: session.accessToken,
        device,
        orderId,
      });

      if (requestVersionRef.current === requestVersion) {
        setProofs(result.proofs);
      }
      return true;
    } catch (requestError) {
      if (requestVersionRef.current === requestVersion) {
        setError(resolvePackingProofError(requestError));
      }
      return false;
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setIsLoading(false);
      }
    }
  }, [device, enabled, orderId, session.accessToken]);

  useEffect(() => {
    if (!enabled || !orderId || !device) {
      requestVersionRef.current += 1;
      setProofs([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    void refresh();
  }, [device, enabled, orderId, refresh]);

  const upload = useCallback(async (file: WmsPackingProofFile) => {
    if (!orderId || !device) {
      setError('Device is not ready for packing proof upload.');
      return false;
    }

    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadMobilePackingProof({
        accessToken: session.accessToken,
        device,
        file,
        orderId,
      });
      setProofs((current) => [result.proof, ...current.filter((proof) => proof.id !== result.proof.id)]);
      return true;
    } catch (requestError) {
      setError(resolvePackingProofError(requestError));
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [device, orderId, session.accessToken]);

  return {
    clearError: () => setError(null),
    error,
    hasProof: proofs.length > 0,
    isLoading,
    isUploading,
    proofs,
    refresh,
    upload,
  };
}

function resolvePackingProofError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Packing proof could not be saved. Please try again.';
}
