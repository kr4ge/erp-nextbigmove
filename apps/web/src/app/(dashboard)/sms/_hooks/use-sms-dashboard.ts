'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import {
  createSmsDeviceEnrollment,
  checkSmsDeviceHeartbeat,
  fetchSmsDevices,
  fetchSmsOverview,
  sendSmsMessage,
} from '../_services/sms-api';
import type { SendSmsMessageInput, SmsEnrollmentResponse } from '../_types/sms';
import {
  clearSmsEnrollmentSession,
  readSmsEnrollmentSession,
  writeSmsEnrollmentSession,
} from '../_utils/sms-enrollment-session';
import { parseSmsError } from '../_utils/sms-errors';
import { useSmsAccess } from './use-sms-access';

export function useSmsDashboard() {
  const access = useSmsAccess();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [enrollment, setEnrollment] = useState<SmsEnrollmentResponse | null>(null);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [enrollmentCopied, setEnrollmentCopied] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ['sms-overview'],
    queryFn: fetchSmsOverview,
    enabled: !access.isLoading && access.canAccessSms,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const devicesQuery = useQuery({
    queryKey: ['sms-devices'],
    queryFn: fetchSmsDevices,
    enabled: !access.isLoading && access.canReadDevices,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    // sessionStorage is unavailable during server rendering, so restore after mount.
    setEnrollment(readSmsEnrollmentSession());
  }, []);

  const enrollmentMutation = useMutation({
    mutationFn: createSmsDeviceEnrollment,
    onSuccess: (result) => {
      setEnrollment(result);
      writeSmsEnrollmentSession(result);
      setEnrollmentCopied(false);
      setEnrollmentOpen(true);
      addToast('success', 'One-time device enrollment key generated.');
    },
    onError: (error: unknown) => {
      addToast(
        'error',
        parseSmsError(error, 'Unable to generate a device enrollment key.'),
      );
    },
  });

  useEffect(() => {
    if (!enrollment) return;

    const expiresIn = Math.max(Date.parse(enrollment.expiresAt) - Date.now(), 0);
    const timeout = window.setTimeout(() => {
      clearSmsEnrollmentSession(enrollment.tenantId);
      setEnrollment(null);
      setEnrollmentOpen(false);
    }, expiresIn);

    return () => window.clearTimeout(timeout);
  }, [enrollment]);

  const sendMutation = useMutation({
    mutationFn: sendSmsMessage,
    onSuccess: (message) => {
      setSendOpen(false);
      addToast('success', `SMS queued for ${message.recipientPhone}.`);
      void queryClient.invalidateQueries({ queryKey: ['sms-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
    },
    onError: (error: unknown) => {
      addToast('error', parseSmsError(error, 'Unable to send the SMS.'));
    },
  });

  const heartbeatMutation = useMutation({
    mutationFn: checkSmsDeviceHeartbeat,
    onSuccess: (result) => {
      addToast(
        result.connected ? 'success' : 'error',
        result.connected
          ? 'Device responded and is connected.'
          : 'Device did not respond. Check its internet, battery settings, and Firebase access.',
      );
      void queryClient.invalidateQueries({ queryKey: ['sms-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['sms-devices'] });
    },
    onError: (error: unknown) => {
      addToast(
        'error',
        parseSmsError(error, 'Unable to verify the device connection.'),
      );
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sms-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['sms-devices'] }),
    ]);
  };

  const copyEnrollment = async () => {
    if (!enrollment) return;

    try {
      await navigator.clipboard.writeText(enrollment.enrollmentToken);
      setEnrollmentCopied(true);
      addToast('success', 'Enrollment key copied.');
    } catch {
      addToast('error', 'Unable to copy the enrollment key.');
    }
  };

  return {
    access,
    overviewQuery,
    devicesQuery,
    enrollment,
    enrollmentOpen,
    enrollmentCopied,
    enrollmentLoading: enrollmentMutation.isPending,
    sendOpen,
    sendLoading: sendMutation.isPending,
    checkingDeviceId: heartbeatMutation.isPending
      ? heartbeatMutation.variables
      : null,
    refreshLoading: overviewQuery.isFetching || devicesQuery.isFetching,
    generateEnrollment: () => enrollmentMutation.mutate(),
    openEnrollment: () => {
      if (enrollment) setEnrollmentOpen(true);
    },
    copyEnrollment,
    sendMessage: (payload: SendSmsMessageInput) => sendMutation.mutate(payload),
    checkDeviceHeartbeat: (deviceId: string) => heartbeatMutation.mutate(deviceId),
    refresh,
    setEnrollmentOpen,
    setSendOpen,
  };
}
