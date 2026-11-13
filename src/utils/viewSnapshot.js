// utils/viewSnapshot.js - Turn what a native view shows into a JPEG file in the cache directory.
// The view needs collapsable={false} so it exists as a real native view.
import { makeImageFromView, ImageFormat } from '@shopify/react-native-skia';

export async function snapshotToFile(viewRef, prefix = 'snapshot') {
  const { File, Paths } = require('expo-file-system');
  const image = await makeImageFromView(viewRef);
  if (!image) throw new Error('Empty snapshot');
  try {
    const bytes = image.encodeToBytes(ImageFormat.JPEG, 92);
    if (!bytes || bytes.length === 0) throw new Error('Could not encode the snapshot');
    const file = new File(Paths.cache, `${prefix}-${Date.now()}.jpg`);
    await file.write(bytes);
    return { uri: file.uri, width: image.width(), height: image.height() };
  } finally {
    try { image.dispose?.(); } catch (_) {}
  }
}

export default snapshotToFile;
