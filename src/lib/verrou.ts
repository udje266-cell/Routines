import * as LocalAuthentication from 'expo-local-authentication';

/** L'appareil peut-il verrouiller l'application (empreinte, visage ou code de l'appareil) ? */
export async function lockAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function unlock(): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Déverrouiller Mes Finances',
    cancelLabel: 'Annuler',
    // Le code de l'appareil reste possible si l'empreinte échoue.
    disableDeviceFallback: false,
  });
  return r.success;
}
