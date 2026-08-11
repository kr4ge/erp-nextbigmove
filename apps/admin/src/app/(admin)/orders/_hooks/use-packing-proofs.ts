'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWmsPackingProofs, uploadWmsPackingProof } from '../_services/fulfillment.service';
import type { WmsPackingProof, WmsPackingProofSource } from '../_types/fulfillment';

export function usePackingProofs(orderId: string | null, enabled: boolean) {
  const [proofs, setProofs] = useState<WmsPackingProof[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshSequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    const refreshSequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = refreshSequence;

    if (!orderId || !enabled) {
      setProofs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchWmsPackingProofs(orderId);
      if (refreshSequenceRef.current === refreshSequence) {
        setProofs(result.proofs);
      }
    } catch (requestError) {
      if (refreshSequenceRef.current === refreshSequence) {
        setError(resolveProofError(requestError));
      }
    } finally {
      if (refreshSequenceRef.current === refreshSequence) {
        setIsLoading(false);
      }
    }
  }, [enabled, orderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(async (file: File, source: WmsPackingProofSource) => {
    if (!orderId) {
      return false;
    }

    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadWmsPackingProof({ orderId, file, source });
      setProofs((current) => [result.proof, ...current.filter((proof) => proof.id !== result.proof.id)]);
      return true;
    } catch (requestError) {
      setError(resolveProofError(requestError));
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [orderId]);

  return {
    proofs,
    latestProof: proofs[0] ?? null,
    hasProof: proofs.length > 0,
    isLoading,
    isUploading,
    error,
    refresh,
    upload,
  };
}

function resolveProofError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return error instanceof Error ? error.message : 'Packing proof could not be processed.';
}
