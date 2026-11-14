import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFinance } from '@/data/finance-context';

import { C } from './ui';

/** « Taxi 500 F enregistré · Annuler » : visible quelques secondes après une saisie, pour réparer une erreur tout de suite. */
export function Toast() {
  const { notice, clearNotice, write } = useFinance();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [failedId, setFailedId] = useState<number | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 7000);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  if (!notice) return null;
  const failed = failedId === notice.id;
  const undo = notice.undo;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96 }}>
      <View accessibilityLiveRegion="polite" accessible
        style={{ backgroundColor: C.marine, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name={failed ? 'alert-circle' : 'checkmark-circle'} size={22} color={failed ? '#FFB4AB' : C.menthe} />
        <Text style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' }}>
          {failed ? 'Annulation impossible : corrigez-la depuis vos opérations.' : notice.text}
        </Text>
        {undo && !failed ? (
          <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Annuler cette saisie" hitSlop={10}
            onPress={async () => {
              setBusy(true);
              try {
                await write(undo);
                clearNotice();
              } catch {
                setFailedId(notice.id);
              } finally {
                setBusy(false);
              }
            }} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }}>
            <Text style={{ color: C.menthe, fontWeight: '800', fontSize: 15 }}>Annuler</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
