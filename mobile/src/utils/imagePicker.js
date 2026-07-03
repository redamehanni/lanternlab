import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const COMMON = { allowsEditing: true, aspect: [4, 3], quality: 0.7 };

export async function pickFromLibrary(square = false) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission requise', "Autorisez l'accès à vos photos.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    ...COMMON,
    aspect: square ? [1, 1] : [4, 3],
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
  });
  return result.canceled ? null : result.assets[0];
}

export async function takePhoto(square = false) {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission requise', "Autorisez l'accès à la caméra.");
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    ...COMMON,
    aspect: square ? [1, 1] : [4, 3],
  });
  return result.canceled ? null : result.assets[0];
}
