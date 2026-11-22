import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, QuestionInput } from '../components/ui';
import { setPending } from '../lib/analyze';
import { colors, radius, type } from '../theme';

const looksLikeUrl = (s: string) => /^\S+\.\S{2,}$/.test(s) && !/\s/.test(s);

export default function LinkScreen() {
  const [value, setValue] = useState('');

  const paste = async () => setValue((await Clipboard.getStringAsync()).trim());

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    setPending(looksLikeUrl(v) ? { kind: 'url', url: v, source: 'paste' } : { kind: 'text', text: v.slice(0, 6000) });
    router.replace('/result');
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={s.wrap}>
      <Text style={s.help}>Paste a web address, or copy the whole text message or email you received.</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="e.g. usps-redelivery.info or the message text"
        placeholderTextColor={colors.textMuted}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={s.input}
      />
      <Pressable onPress={paste} style={s.paste} accessibilityRole="button">
        <Text style={s.pasteText}>Paste from clipboard</Text>
      </Pressable>
      <QuestionInput />
      <View style={{ flex: 1 }} />
      <PrimaryButton label="CHECK IT" onPress={submit} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 14, paddingBottom: 40 },
  help: { color: colors.textMuted, ...type.body },
  input: {
    minHeight: 160,
    color: colors.text,
    fontSize: 18,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    padding: 16,
    textAlignVertical: 'top',
  },
  paste: { alignSelf: 'flex-start', paddingVertical: 10 },
  pasteText: { color: colors.mint, fontSize: 17, fontWeight: '600' },
});
