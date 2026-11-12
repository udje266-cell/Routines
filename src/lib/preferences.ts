import * as SecureStore from 'expo-secure-store';

import { DEFAULT_REMINDERS, type ReminderSettings } from '@/domain';

/** Préférences propres à cet appareil (jamais envoyées au serveur), effacées à la déconnexion. */
export interface DevicePrefs {
  lock: boolean;
  reminders: ReminderSettings;
}

const KEY = 'mes-finances.prefs';
export const DEFAULT_PREFS: DevicePrefs = { lock: false, reminders: DEFAULT_REMINDERS };

export async function loadPrefs(): Promise<DevicePrefs> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<DevicePrefs>;
    return { lock: !!p.lock, reminders: { ...DEFAULT_REMINDERS, ...p.reminders } };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(p: DevicePrefs): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(p));
}

export async function clearPrefs(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
