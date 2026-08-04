import type { SmsEnrollmentResponse } from '../_types/sms';

const SMS_ENROLLMENT_SESSION_KEY = 'sms_device_enrollment';

export function readSmsEnrollmentSession() {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.sessionStorage.getItem(SMS_ENROLLMENT_SESSION_KEY);
    if (!rawValue) return null;

    const enrollment = JSON.parse(rawValue) as SmsEnrollmentResponse;
    if (
      typeof enrollment.enrollmentToken !== 'string'
      || !enrollment.enrollmentToken
      || !isEnrollmentActive(enrollment)
    ) {
      clearSmsEnrollmentSession();
      return null;
    }

    return enrollment;
  } catch {
    clearSmsEnrollmentSession();
    return null;
  }
}

export function writeSmsEnrollmentSession(enrollment: SmsEnrollmentResponse) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    SMS_ENROLLMENT_SESSION_KEY,
    JSON.stringify(enrollment),
  );
}

export function clearSmsEnrollmentSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(SMS_ENROLLMENT_SESSION_KEY);
}

export function isEnrollmentActive(enrollment: SmsEnrollmentResponse) {
  const expiresAt = Date.parse(enrollment.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}
