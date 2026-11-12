import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from '@/domain';

const CHANNEL = 'rappels';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Demande l'autorisation (Android 13+) ; renvoie false si refusée. */
export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rappels', importance: AndroidImportance.DEFAULT,
      // Contenu masqué sur l'écran verrouillé, quel que soit le réglage de détails.
      lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Remplace tous les rappels programmés par la liste donnée (identifiants stables : pas de doublon). */
export async function scheduleReminders(list: Reminder[]): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  let n = 0;
  for (const r of list) {
    // Abidjan = UTC+0 toute l'année : la date civile et l'heure se convertissent directement.
    const at = new Date(`${r.date}T${String(r.hour).padStart(2, '0')}:00:00Z`);
    if (at.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
    n++;
  }
  return n;
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
