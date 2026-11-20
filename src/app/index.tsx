import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionRow, PrimaryButton } from '../components/ui';
import { setPending } from '../lib/analyze';
import { pickScreenshot, takePhoto } from '../lib/pickImage';
import { colors, type } from '../theme';

export default function Home() {
  const runImage = async (pick: typeof pickScreenshot) => {
    const req = await pick();
    if (!req) return;
    setPending(req);
    router.push('/result');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={s.brand}>LENS</Text>
        <Text style={s.hero}>What do you want to understand?</Text>

        <PrimaryButton
          label="SCAN SOMETHING"
          sub="Choose a screenshot of a text, email or website"
          onPress={() => runImage(pickScreenshot)}
        />

        <View style={s.list}>
          <ActionRow
            icon="🔗"
            label="Check a link or message"
            hint="Paste a web address or the text you received"
            onPress={() => router.push('/link')}
          />
          <ActionRow
            icon="▦"
            label="Scan a QR code"
            hint="See where it goes before you open it"
            onPress={() => router.push('/qr')}
          />
          <ActionRow
            icon="📷"
            label="Take a photo"
            hint="A letter, a sign, a screen — anything you’re unsure about"
            onPress={() => runImage(takePhoto)}
          />
          <ActionRow
            icon="🛡"
            label="LENS Watch"
            hint="Automatic text-message filtering — coming soon"
            onPress={() =>
              Alert.alert(
                'Coming soon',
                'LENS Watch will sort scam texts from unknown senders into your Junk folder automatically. We’ll let you know when it’s ready.'
              )
            }
          />
        </View>

        <Text style={s.foot}>
          LENS gives its best judgement and shows you why. It can be wrong — when money or passwords are involved,
          check directly with the company using a number or app you already trust.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, gap: 20, paddingBottom: 48 },
  brand: { color: colors.mint, ...type.label, fontSize: 15, letterSpacing: 4, marginTop: 8 },
  hero: { color: colors.text, ...type.hero },
  list: { gap: 12 },
  foot: { color: colors.textMuted, ...type.small, marginTop: 8 },
});
