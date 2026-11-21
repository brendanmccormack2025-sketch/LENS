import AsyncStorage from '@react-native-async-storage/async-storage';

// iOS gives apps no way to check whether the user switched on the text filter or the
// Safari extension, so we ask them to confirm once and remember it. Calls are detected
// for real via CallKit (see callProtection.ts).
export type ManualProtection = 'texts' | 'safari';

const key = (p: ManualProtection) => `setup.${p}`;

export async function getManual(): Promise<Record<ManualProtection, boolean>> {
  const [t, s] = await Promise.all([AsyncStorage.getItem(key('texts')), AsyncStorage.getItem(key('safari'))]);
  return { texts: t === '1', safari: s === '1' };
}

export async function setManual(p: ManualProtection, on: boolean) {
  await AsyncStorage.setItem(key(p), on ? '1' : '0');
}
