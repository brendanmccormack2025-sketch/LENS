// Palette taken from the concept mockup (black + mint), but with higher-contrast
// secondary text and larger type — the target user is not a security nerd.
export const colors = {
  bg: '#0A0B0A',
  surface: '#141614',
  surfaceRaised: '#1C1F1C',
  border: '#2A2E2A',
  mint: '#2BF5A4',
  mintDim: '#A8EFCB',
  onMint: '#04140C',
  text: '#F2F5F3',
  textMuted: '#B4BCB7', // mockup used ~#6b6b6b; too faint for older eyes
  safe: '#2BF5A4',
  caution: '#FFC53D',
  danger: '#FF5A5F',
  unclear: '#9DB4FF',
};

export const type = {
  hero: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const },
  body: { fontSize: 18, lineHeight: 26 },
  small: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 1.2 },
};

export const radius = 16;
