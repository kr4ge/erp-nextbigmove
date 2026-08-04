'use client';

import { usePermissions } from '@/hooks/use-permissions';

const SMS_ACCESS_PERMISSIONS = [
  'sms.inbox.read',
  'sms.messages.send',
  'sms.devices.manage',
  'sms.templates.manage',
  'sms.routes.manage',
  'sms.settings.manage',
  'sms.logs.read',
  'sms.messages.redact',
];

export function useSmsAccess() {
  const permissionsQuery = usePermissions();
  const permissions = permissionsQuery.data ?? [];

  return {
    isLoading: permissionsQuery.isLoading,
    canAccessSms: SMS_ACCESS_PERMISSIONS.some((permission) =>
      permissions.includes(permission),
    ),
    canManageDevices: permissions.includes('sms.devices.manage'),
    canReadDevices:
      permissions.includes('sms.devices.manage')
      || permissions.includes('sms.inbox.read'),
    canSendMessages: permissions.includes('sms.messages.send'),
  };
}
