import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { formatFcfa, type Operation, type Wallet } from '@/domain';
import { categoryLabel, itemIcon } from '@/lib/categories';

import { C } from './ui';

/** Une entrée ou une sortie ; toucher la ligne pour la modifier ou la supprimer. */
export function OperationLine({ op, wallets }: { op: Operation; wallets: Wallet[] }) {
  const income = op.kind === 'rentree';
  const transfer = op.kind === 'transfert';
  const from = wallets.find((w) => w.id === op.walletId)?.name ?? '';
  const to = wallets.find((w) => w.id === op.toWalletId)?.name ?? '';
  const title = op.label || (op.category ? categoryLabel(op.category) : income ? 'Argent reçu' : 'Dépense');
  const sub = transfer ? `${from} → ${to}` : `${from}${op.category && op.label !== op.category ? ` · ${categoryLabel(op.category)}` : ''}${op.incomeType === 'petite' ? ' · petite somme' : ''}`;
  return (
    <Pressable onPress={() => router.push({ pathname: '/operation', params: { id: op.id } })} accessibilityRole="button"
      accessibilityLabel={`${title}, ${income ? 'plus' : 'moins'} ${formatFcfa(op.amount)}, ${sub}. Modifier ou supprimer`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: income ? C.mentheClair : C.lavandeClair }}>
        <Ionicons name={transfer ? 'swap-horizontal' : itemIcon(op.label, op.category, op.kind)} size={22} color={C.texte} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.texte }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 14, color: C.secondaire }} numberOfLines={1}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: income ? C.mentheTexte : C.texte }}>
        {income ? '+' : transfer ? '' : '−'}{formatFcfa(op.amount + (op.fee ?? 0))}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={C.secondaire} />
    </Pressable>
  );
}
