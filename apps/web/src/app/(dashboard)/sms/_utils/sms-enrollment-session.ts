import type { SmsEnrollmentResponse } from '../_types/sms';

const SMS_ENROLLMENT_SESSION_KEY = 'sms_device_enrollment';

function enrollmentSessionKey(tenantId: string) {
  return `${SMS_ENROLLMENT_SESSION_KEY}:${tenantId}`;
}

export function readSmsEnrollmentSession() {
  if (typeof window === 'undefined') return null;

  try {
    const tenantId = window.localStorage.getItem('current_tenant_id');
    if (!tenantId) return null;

    // Remove the previous unscoped value so a token can never leak across tenants.
    window.sessionStorage.removeItem(SMS_ENROLLMENT_SESSION_KEY);
    const rawValue = window.sessionStorage.getItem(enrollmentSessionKey(tenantId));
    if (!rawValue) return null;

    const enrollment = JSON.parse(rawValue) as SmsEnrollmentResponse;
    if (
      enrollment.tenantId !== tenantId
      || typeof enrollment.enrollmentToken !== 'string'
      || !enrollment.enrollmentToken
      || !isEnrollmentActive(enrollment)
    ) {
      clearSmsEnrollmentSession(tenantId);
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
    enrollmentSessionKey(enrollment.tenantId),
    JSON.stringify(enrollment),
  );
}

export function clearSmsEnrollmentSession(tenantId?: string) {
  if (typeof window === 'undefined') return;
  const scopedTenantId = tenantId ?? window.localStorage.getItem('current_tenant_id');
  if (scopedTenantId) {
    window.sessionStorage.removeItem(enrollmentSessionKey(scopedTenantId));
  }
  window.sessionStorage.removeItem(SMS_ENROLLMENT_SESSION_KEY);
}

export function isEnrollmentActive(enrollment: SmsEnrollmentResponse) {
  const expiresAt = Date.parse(enrollment.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}
