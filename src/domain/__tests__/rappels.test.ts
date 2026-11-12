/// <reference types="jest" />
import { buildReminders, DEFAULT_REMINDERS, type Snapshot } from '..';

const snap: Snapshot = {
  today: '2026-11-12',
  wallets: [{ id: 'w', name: 'Wave', kind: 'wave', everyday: true, balance: 50_000 }],
  planned: [
    { id: 'loyer', kind: 'sortie', label: 'Loyer', amount: 25_000, date: '2026-11-13', walletId: 'w', source: 'facture' },
    { id: 'sal', kind: 'rentree', label: 'Salaire', amount: 120_000, date: '2026-11-30', walletId: 'w', certainty: 'attendue' },
  ],
  intents: [{ id: 'i', amount: 18_000, category: 'Habillement', walletId: 'w', date: '2026-11-14', status: 'en_pause', createdOn: '2026-11-12' }],
};
const on = { ...DEFAULT_REMINDERS, enabled: true };

it('désactivés par défaut', () => {
  expect(buildReminders(snap, DEFAULT_REMINDERS)).toEqual([]);
});

it('masquent noms et montants par défaut', () => {
  const r = buildReminders(snap, on);
  expect(r.map((x) => [x.id, x.date])).toEqual([['echeance-loyer', '2026-11-12'], ['pause-i', '2026-11-14']]);
  for (const x of r) expect(`${x.title} ${x.body}`).not.toMatch(/Loyer|25|18|Habillement|Salaire/);
});

it('détails seulement si l’utilisateur les active', () => {
  expect(buildReminders(snap, { ...on, showDetails: true })[0].body).toMatch(/Loyer : 25 000 F demain/);
});

it('pas de rappel pour une date d’envoi passée', () => {
  expect(buildReminders(snap, { ...on, daysBefore: 3 }).map((x) => x.id)).toEqual(['pause-i']);
});
