import { addDays, type CivilDate, formatDateFr } from './dates';
import { forecast } from './forecast';
import { formatFcfa } from './money';
import type { Snapshot } from './types';

export interface ReminderSettings {
  enabled: boolean;
  /** Jours d'avance pour les échéances (0 = le jour même). */
  daysBefore: number;
  /** Heure locale d'envoi (Abidjan). */
  hour: number;
  /** Afficher noms et montants : désactivé par défaut (écran verrouillé, téléphone prêté…). */
  showDetails: boolean;
  /** Rappel chaque soir pour noter les dépenses du jour (les petites coupures s'oublient vite). */
  evening?: boolean;
  /** Heure du rappel du soir (20 h par défaut). */
  eveningHour?: number;
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, daysBefore: 1, hour: 8, showDetails: false, evening: false, eveningHour: 20 };

export interface Reminder {
  /** Identifiant stable : reprogrammer ne crée pas de doublon. */
  id: string;
  /** Jour d'envoi. */
  date: CivilDate;
  hour: number;
  title: string;
  body: string;
}

const TITLE = 'Mes Finances';

/**
 * Rappels facultatifs : échéances à venir et achats en pause à revoir.
 * Par défaut le texte ne contient ni nom ni montant.
 */
export function buildReminders(snap: Snapshot, s: ReminderSettings, maxDays = 30): Reminder[] {
  if (!s.enabled) return [];
  const last = addDays(snap.today, maxDays);
  const out: Reminder[] = [];
  const when = (n: number) => (n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`);

  for (const e of forecast(snap).events) {
    if (e.item.kind === 'rentree' || e.overdue || e.item.source === 'epargne') continue;
    const send = addDays(e.date, -s.daysBefore);
    if (send < snap.today || send > last) continue;
    out.push({
      id: `echeance-${e.item.id}`,
      date: send,
      hour: s.hour,
      title: TITLE,
      body: s.showDetails
        ? `${e.item.label} : ${formatFcfa(e.item.amount)} ${when(s.daysBefore)} (${formatDateFr(e.date)}).`
        : `Une échéance arrive ${when(s.daysBefore)}. Ouvrez l’application pour voir le détail.`,
    });
  }

  for (const i of snap.intents ?? []) {
    if (i.status !== 'en_pause' || i.date < snap.today || i.date > last) continue;
    out.push({
      id: `pause-${i.id}`,
      date: i.date,
      hour: s.hour,
      title: TITLE,
      body: s.showDetails ? `Achat en pause à revoir : ${formatFcfa(i.amount)} (${i.category}).` : 'Un achat en pause est à revoir aujourd’hui.',
    });
  }
  if (s.evening) {
    // Les 7 prochains soirs (reprogrammés à chaque ouverture) ; jamais de montant dans ce rappel.
    for (let i = 0; i < 7; i++) {
      const d = addDays(snap.today, i);
      out.push({ id: `soir-${d}`, date: d, hour: s.eveningHour ?? 20, title: TITLE, body: 'Avez-vous noté vos dépenses et vos petites sommes d’aujourd’hui ? 30 secondes suffisent.' });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
