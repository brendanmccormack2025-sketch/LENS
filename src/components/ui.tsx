import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { MAX_QUESTION, setQuestion } from '../lib/analyze';
import { AppText as Text } from './AppText';
import * as Haptics from 'expo-haptics';
import { colors, radius, type } from '../theme';
import type { Verdict } from '../lib/types';

export function PrimaryButton({ label, onPress, sub }: { label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [s.primary, pressed && { opacity: 0.85 }]}
    >
      <Text style={s.primaryLabel}>{label}</Text>
      {sub ? <Text style={s.primarySub}>{sub}</Text> : null}
    </Pressable>
  );
}

/** Optional "What's confusing you?" box. Its text is sent as `question` with the next scan. */
export function QuestionInput({ dark }: { dark?: boolean }) {
  const [value, setValue] = useState('');
  // Start empty every time the screen comes into focus (e.g. back from a result).
  useFocusEffect(
    useCallback(() => {
      setValue('');
      setQuestion('');
    }, [])
  );
  return (
    <TextInput
      value={value}
      onChangeText={(t) => {
        setValue(t);
        setQuestion(t);
      }}
      maxLength={MAX_QUESTION}
      placeholder="What's confusing you? (optional)"
      placeholderTextColor={dark ? '#ccc' : colors.textMuted}
      accessibilityLabel="What's confusing you? Optional"
      returnKeyType="done"
      style={[s.question, dark && s.questionDark]}
    />
  );
}

export function ActionRow({ icon, label, hint, onPress }: { icon: string; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surfaceRaised }]}
    >
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowHint}>{hint}</Text>
      </View>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}

export const verdictStyle: Record<Verdict, { color: string; label: string; icon: string }> = {
  likely_safe: { color: colors.safe, label: 'LOOKS OK', icon: '✓' },
  be_careful: { color: colors.caution, label: 'BE CAREFUL', icon: '!' },
  likely_scam: { color: colors.danger, label: 'LIKELY A SCAM', icon: '✕' },
  unclear: { color: colors.unclear, label: 'CAN’T TELL', icon: '?' },
};

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={s.section}>{children}</Text>;
}

const s = StyleSheet.create({
  question: {
    color: colors.text,
    fontSize: 17,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  questionDark: { backgroundColor: '#000b', color: '#fff', borderColor: '#fff6' },
  primary: {
    backgroundColor: colors.mint,
    borderRadius: radius,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  primaryLabel: { color: colors.onMint, fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  primarySub: { color: colors.onMint, opacity: 0.75, fontSize: 15, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: radius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: { fontSize: 26, width: 32, textAlign: 'center' },
  rowLabel: { color: colors.text, fontSize: 18, fontWeight: '600' },
  rowHint: { color: colors.textMuted, ...type.small, marginTop: 2 },
  chev: { color: colors.textMuted, fontSize: 28 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  section: { color: colors.mintDim, ...type.label, marginBottom: 10, marginTop: 8 },
});
