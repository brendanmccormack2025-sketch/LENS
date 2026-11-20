import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ResultView } from '../components/ResultView';
import { PrimaryButton } from '../components/ui';
import { analyze, LimitReachedError, takePending } from '../lib/analyze';
import type { AnalyzeResponse } from '../lib/types';
import { colors, type } from '../theme';

type State =
  | { status: 'loading' }
  | { status: 'done'; data: AnalyzeResponse }
  | { status: 'error'; message: string; limit?: boolean };

export default function Result() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const req = takePending();
    if (!req) {
      router.replace('/');
      return;
    }
    analyze(req)
      .then((data) => setState({ status: 'done', data }))
      .catch((e: Error) => setState({ status: 'error', message: e.message, limit: e instanceof LimitReachedError }));
  }, []);

  if (state.status === 'loading') {
    return (
      <View style={[s.fill, s.center]}>
        <ActivityIndicator color={colors.mint} size="large" />
        <Text style={s.loading}>Looking closely…</Text>
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={[s.fill, s.center, { padding: 24, gap: 16 }]}>
        <Text style={s.errTitle}>{state.limit ? 'You’ve used today’s free scans' : 'That didn’t work'}</Text>
        <Text style={s.body}>{state.message}</Text>
        <PrimaryButton label="BACK" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={s.fill} contentContainerStyle={s.wrap}>
      <ResultView data={state.data} />
      <View style={{ height: 12 }} />
      <PrimaryButton label="DONE" onPress={() => router.dismissTo('/')} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  wrap: { padding: 20, paddingBottom: 48 },
  loading: { color: colors.textMuted, ...type.body, marginTop: 16 },
  errTitle: { color: colors.text, ...type.title, textAlign: 'center' },
  body: { color: colors.text, ...type.body },
});
