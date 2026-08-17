export type ErpProcessRole = 'all' | 'api' | 'worker';

export function resolveProcessRole(value = process.env.PROCESS_ROLE): ErpProcessRole {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'api' || normalized === 'worker') {
    return normalized;
  }

  return 'all';
}

export function shouldRunPancakeWorkers(value = process.env.PROCESS_ROLE) {
  return resolveProcessRole(value) !== 'api';
}

export function shouldRunApiBackgroundServices(value = process.env.PROCESS_ROLE) {
  return resolveProcessRole(value) !== 'worker';
}
