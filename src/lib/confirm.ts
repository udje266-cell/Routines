import { Alert, Platform } from 'react-native';

/** Demande confirmation avant une action irréversible (boîte de dialogue Android, ou confirm sur le web). */
export function confirmAction(title: string, message: string, ok: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [{ text: 'Annuler', style: 'cancel' }, { text: ok, style: 'destructive', onPress: onOk }]);
}
