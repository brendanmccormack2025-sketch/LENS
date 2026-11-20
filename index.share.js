// Entry point for the iOS share extension (a separate, smaller JS bundle).
import { AppRegistry } from 'react-native';
import { markShareExtension } from './src/components/AppText';
import ShareExtension from './src/share/ShareExtension';

markShareExtension();

// The first argument must be exactly "shareExtension".
AppRegistry.registerComponent('shareExtension', () => ShareExtension);
