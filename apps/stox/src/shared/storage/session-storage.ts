import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { DeviceIdentity, StoredSession } from '@/src/features/auth/types';

const SESSION_KEY = 'stox.session';
const DEVICE_KEY = 'stox.device';

function generateId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}-${time}-${random}`;
}

function getDefaultDeviceName() {
  return Platform.OS === 'android' ? 'Android handheld' : 'STOX device';
}

export async function readStoredSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function writeStoredSession(session: StoredSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const raw = await SecureStore.getItemAsync(DEVICE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as DeviceIdentity;
    } catch {
      // Fall through to regenerate.
    }
  }

  const identity: DeviceIdentity = {
    id: generateId('stox-device'),
    name: getDefaultDeviceName(),
  };

  await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(identity));
  return identity;
}
