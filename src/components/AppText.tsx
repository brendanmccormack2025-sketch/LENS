import { Text, type TextProps } from 'react-native';

// React Native's font scaling breaks inside iOS share extensions. In the main
// app we keep Dynamic Type on (important for older users); the share extension
// flips this flag before rendering anything.
let inShareExtension = false;
export const markShareExtension = () => {
  inShareExtension = true;
};

export function AppText(props: TextProps) {
  return <Text {...props} allowFontScaling={inShareExtension ? false : props.allowFontScaling} />;
}
