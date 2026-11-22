import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Scan' }} />
        <Stack.Screen name="protection" options={{ title: 'Your protection', headerBackTitle: 'Scan' }} />
        <Stack.Screen name="link" options={{ title: 'Check a link or message' }} />
        <Stack.Screen name="qr" options={{ title: 'Scan a QR code', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="result" options={{ title: 'What Wary found' }} />
        <Stack.Screen name="watch" options={{ title: 'Wary Watch' }} />
        <Stack.Screen name="setup" options={{ title: 'Set up Wary', headerBackTitle: 'Home' }} />
      </Stack>
    </>
  );
}
