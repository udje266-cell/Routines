import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { C } from './ui';

/** Anneau de progression du mois (« Jour 12 ») : lavande en fond, dégradé menthe pour la part écoulée. */
export function CycleRing({ day, length, size = 150 }: { day: number; length: number; size?: number }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, day / length));
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`Jour ${day} sur ${length} du mois`}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.menthe} />
              <Stop offset="1" stopColor={C.mentheVif} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.lavande} strokeWidth={stroke} fill="#fff" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="url(#g)" strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${circ * progress} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: C.texte }}>Jour {day}</Text>
          <Text style={{ fontSize: 13, color: C.secondaire }}>sur {length}</Text>
        </View>
      </View>
    </View>
  );
}
