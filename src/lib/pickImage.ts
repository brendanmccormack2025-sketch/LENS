import * as ImagePicker from 'expo-image-picker';
import { prepareImage } from './prepareImage';
import type { AnalyzeRequest } from './types';

/** Opens the photo library (screenshots live there) and returns a ready request. */
export async function pickScreenshot(): Promise<AnalyzeRequest | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false });
  return toRequest(res);
}

/** Takes a photo of something physical (a letter, a parking-meter sticker, a screen). */
export async function takePhoto(): Promise<AnalyzeRequest | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] });
  return toRequest(res);
}

async function toRequest(res: ImagePicker.ImagePickerResult): Promise<AnalyzeRequest | null> {
  if (res.canceled || !res.assets[0]?.uri) return null;
  return prepareImage(res.assets[0].uri);
}
