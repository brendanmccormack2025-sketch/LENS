import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { getCallStatus, isPasscodeSet, safariLastSeen, syncCallList } from './callProtection';
import { getManual } from './setup';

/** How many of Wary's background protections are on. Refreshes on focus and app resume. */
export function useProtectionSummary() {
  const [state, setState] = useState({ on: 0, total: 4, loaded: false });

  const refresh = useCallback(async () => {
    const [calls, manual] = await Promise.all([getCallStatus(), getManual()]);
    const flags = [calls === 'enabled', manual.texts, manual.safari || safariLastSeen() != null, isPasscodeSet() === true];
    setState({ on: flags.filter(Boolean).length, total: flags.length, loaded: true });
    if (calls === 'enabled') syncCallList().catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
      return () => sub.remove();
    }, [refresh])
  );

  return { ...state, allOn: state.loaded && state.on === state.total };
}
