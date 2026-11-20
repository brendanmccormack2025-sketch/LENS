import { clearAppGroupContainer, close, type InitialProps } from 'expo-share-extension';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { ResultView } from '../components/ResultView';
import { PrimaryButton } from '../components/ui';
import { analyze, LimitReachedError } from '../lib/analyze';
import { prepareImage } from '../lib/prepareImage';
import type { AnalyzeRequest, AnalyzeResponse } from '../lib/types';
import { colors, type } from '../theme';

type State =
  | { status: 'loading'; step: string }
  | { status: 'done'; data: AnalyzeResponse }
  | { status: 'error'; title: string; message: string };

const isSingleUrl = (s: string) => /^(https?:\/\/)?[^\s/]+\.[^\s]{2,}$/i.test(s.trim());

async function toRequest(p: InitialProps): Promise<AnalyzeRequest | null> {
  const image = p.images?.[0];
  if (image) {
    const uri = image.startsWith('file://') ? image : `file://${image}`;
    try {
      return await prepareImage(uri);
    } finally {
      clearAppGroupContainer().catch(() => {}); // don't leave shared screenshots lying around
    }
  }
  if (p.url) return { kind: 'url', url: p.url, source: 'share' };
  if (p.text?.trim()) {
    const t = p.text.trim();
    return isSingleUrl(t) ? { kind: 'url', url: t, source: 'share' } : { kind: 'text', text: t.slice(0, 6000) };
  }
  return null;
}

export default function ShareExtension(props: InitialProps) {
  const [state, setState] = useState<State>({ status: 'loading', step: 'Reading what you shared…' });

  useEffect(() => {
    (async () => {
      const req = await toRequest(props).catch(() => null);
      if (!req) {
        setState({ status: 'error', title: 'Nothing to check', message: 'LENS can check links, text and screenshots.' });
        return;
      }
      setState({ status: 'loading', step: 'Looking closely…' });
      try {
        setState({ status: 'done', data: await analyze(req) });
      } catch (e) {
        const limit = e instanceof LimitReachedError;
        setState({
          status: 'error',
          title: limit ? 'You’ve used today’s free scans' : 'That didn’t work',
          message: (e as Error).message,
        });
      }
    })();
    // Initial props never change for a share extension instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={s.sheet}>
      <View style={s.header}>
        <Text style={s.brand}>LENS</Text>
        <Pressable onPress={close} hitSlop={16} accessibilityLabel="Close" style={s.close}>
          <Text style={s.closeText}>✕</Text>
        </Pressable>
      </View>

      {state.status === 'loading' && (
        <View style={s.center}>
          <ActivityIndicator color={colors.mint} size="large" />
          <Text style={s.loading}>{state.step}</Text>
        </View>
      )}

      {state.status === 'error' && (
        <View style={[s.center, { gap: 12 }]}>
          <Text style={s.errTitle}>{state.title}</Text>
          <Text style={s.body}>{state.message}</Text>
        </View>
      )}

      {state.status === 'done' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
          <ResultView data={state.data} compact />
        </ScrollView>
      )}

      {state.status !== 'loading' && (
        <View style={{ paddingTop: 12 }}>
          <PrimaryButton label="DONE" onPress={close} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  brand: { color: colors.mint, ...type.label, fontSize: 15, letterSpacing: 4 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.text, fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  loading: { color: colors.textMuted, ...type.body, marginTop: 16 },
  errTitle: { color: colors.text, ...type.title, textAlign: 'center' },
  body: { color: colors.textMuted, ...type.body, textAlign: 'center' },
});
