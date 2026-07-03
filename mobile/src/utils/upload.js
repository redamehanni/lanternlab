import { Platform } from 'react-native';

/**
 * Ajoute une image issue d'expo-image-picker à un FormData,
 * de façon compatible web ET natif.
 *
 * Sur le web, FormData exige un Blob/File réel (pas un objet {uri}).
 * C'était la cause des photos qui ne se sauvegardaient pas (issue #3).
 */
export async function appendImage(formData, asset, fieldName = 'image') {
  if (!asset) return formData;

  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
    formData.append(fieldName, blob, asset.fileName || `photo.${ext}`);
  } else {
    formData.append(fieldName, {
      uri: asset.uri,
      name: asset.fileName || `photo_${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
  }
  return formData;
}
