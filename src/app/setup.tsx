import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsMock } from '../components/SettingsMock';
import { PrimaryButton } from '../components/ui';
import { getCallStatus, nativeAvailable, openCallSettings, safariLastSeen, syncCallList } from '../lib/callProtection';
import { getManual, markOnboarded, setManual } from '../lib/setup';
import { colors, radius, type } from '../theme';

type StepKey = 'calls' | 'texts' | 'safari';
const ORDER: StepKey[] = ['calls', 'texts', 'safari'];

/**
 * Guided setup: one protection per screen, a drawing of the exact Settings screen,
 * a button that goes as close to it as iOS allows, and automatic detection where
 * iOS gives us a signal (calls, Safari). Advances on its own when a step turns on.
 */
export default function Setup() {
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Record<StepKey, boolean>>({ calls: false, texts: false, safari: false });
  const step = ORDER[i];
  const stepRef = useRef(step);
  stepRef.current = step;

  const check = useCallback(async () => {
    const [calls, manual] = await Promise.all([getCallStatus(), getManual()]);
    const next = { calls: calls === 'enabled', texts: manual.texts, safari: manual.safari || safariLastSeen() != null };
    setDone(next);
    if (next.calls) syncCallList().catch(() => {});
    // Coming back from Settings with the current step now on → move ahead.
    if (next[stepRef.current]) {
      setI((cur) => (ORDER[cur] === stepRef.current && cur < ORDER.length - 1 ? cur + 1 : cur));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Seeing setup once is enough — don't push it on every launch if they back out.
      markOnboarded();
      check();
      const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
      return () => sub.remove();
    }, [check])
  );

  const finish = async () => {
    await markOnboarded();
    router.dismissTo('/');
  };
  const next = () => (i < ORDER.length - 1 ? setI(i + 1) : finish());
  const isDone = done[step];

  return (
    <SafeAreaView style={s.fill} edges={['bottom']}>
      <View style={s.dots}>
        {ORDER.map((k, n) => (
          <View key={k} style={[s.dot, n === i && s.dotNow, done[k] && s.dotDone]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.wrap}>
        {step === 'calls' && (
          <>
            <Text style={s.kicker}>STEP 1 OF 3 · ABOUT 15 SECONDS</Text>
            <Text style={s.title}>Spot scam calls before you answer</Text>
            <Text style={s.body}>
              Numbers other people reported will show <Text style={s.b}>“Wary: Reported scam”</Text> on your screen when
              they call.
            </Text>
            <SettingsMock
              title="Call Blocking & Identification"
              rows={[{ label: 'Wary', toggle: isDone, highlight: !isDone }]}
            />
            <Text style={s.small}>Tap the button, switch on Wary, then come back here.</Text>
          </>
        )}

        {step === 'texts' && (
          <>
            <Text style={s.kicker}>STEP 2 OF 3 · ABOUT 30 SECONDS</Text>
            <Text style={s.title}>Send scam texts to Junk</Text>
            <Text style={s.body}>
              In Settings, go to <Text style={s.b}>Apps → Messages</Text>. Then:
            </Text>
            <SettingsMock
              title="Messages"
              rows={[
                { label: 'Screen Unknown Senders', toggle: true, highlight: !isDone },
                { label: 'Text Message Filter', value: isDone ? 'Wary' : 'None', highlight: !isDone },
              ]}
            />
            <SettingsMock title="Text Message Filter" rows={[{ label: 'None' }, { label: 'Wary', highlight: !isDone }]} />
            <Text style={s.small}>
              Only texts from numbers not in your contacts are checked — on your phone, never sent anywhere.
            </Text>
          </>
        )}

        {step === 'safari' && (
          <>
            <Text style={s.kicker}>STEP 3 OF 3 · ABOUT 30 SECONDS</Text>
            <Text style={s.title}>Get warned on fake websites</Text>
            <Text style={s.body}>
              In Settings, go to <Text style={s.b}>Apps → Safari → Extensions → Wary</Text>. Then:
            </Text>
            <SettingsMock
              title="Wary"
              rows={[
                { label: 'Allow Extension', toggle: true, highlight: !isDone },
                { label: 'All Websites', value: 'Allow', highlight: !isDone },
              ]}
            />
            <Text style={s.small}>
              Then tap “Test it” below — Wary will notice it’s working and tick this off by itself.
            </Text>
          </>
        )}

        {isDone ? (
          <View style={s.success}>
            <Text style={s.successText}>✓ That’s on. Nice work.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.footer}>
        {isDone ? (
          <PrimaryButton label={i < ORDER.length - 1 ? 'NEXT' : 'FINISH'} onPress={next} />
        ) : step === 'calls' ? (
          <PrimaryButton
            label="TAKE ME THERE"
            sub={nativeAvailable() ? 'Opens the exact switch in Settings' : undefined}
            onPress={openCallSettings}
          />
        ) : step === 'texts' ? (
          <>
            <PrimaryButton label="OPEN SETTINGS" onPress={() => Linking.openSettings()} />
            <Pressable
              onPress={async () => {
                await setManual('texts', true);
                check();
              }}
              style={s.secondary}
            >
              <Text style={s.secondaryText}>I chose Wary ✓</Text>
            </Pressable>
          </>
        ) : (
          <>
            <PrimaryButton label="OPEN SETTINGS" onPress={() => Linking.openSettings()} />
            <Pressable onPress={() => Linking.openURL('https://www.apple.com')} style={s.secondary}>
              <Text style={s.secondaryText}>Test it in Safari</Text>
            </Pressable>
          </>
        )}
        <Pressable onPress={next} style={{ padding: 10, alignItems: 'center' }}>
          <Text style={s.skip}>{i < ORDER.length - 1 ? 'Skip this step' : 'Skip and finish'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingTop: 12 },
  dot: { width: 28, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotNow: { backgroundColor: colors.mintDim },
  dotDone: { backgroundColor: colors.mint },
  wrap: { padding: 20, gap: 14, paddingBottom: 24 },
  kicker: { color: colors.mintDim, ...type.label },
  title: { color: colors.text, ...type.hero, fontSize: 28 },
  body: { color: colors.text, ...type.body },
  b: { fontWeight: '700' },
  small: { color: colors.textMuted, ...type.small },
  success: { backgroundColor: colors.surfaceRaised, borderRadius: radius, padding: 14, borderWidth: 2, borderColor: colors.safe },
  successText: { color: colors.safe, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  footer: { paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
  secondary: { borderWidth: 2, borderColor: colors.mint, borderRadius: radius, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: colors.mint, fontSize: 17, fontWeight: '700' },
  skip: { color: colors.textMuted, fontSize: 16 },
});
