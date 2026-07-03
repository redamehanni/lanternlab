import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { pickFromLibrary, takePhoto } from '../utils/imagePicker';
import { imageUrl } from '../utils/format';
import { COLORS } from '../config';

/**
 * Champ photo réutilisable (prise de photo + import).
 * - `asset` : asset local sélectionné (prioritaire)
 * - `existingUrl` : URL serveur d'une image déjà enregistrée
 * - `onChange(asset)` : callback
 * - `circle` : rendu rond (avatars)
 */
export default function ImageField({ asset, existingUrl, onChange, circle = false, label = 'Photo' }) {
  const preview = asset?.uri || imageUrl(existingUrl);
  const size = circle ? 110 : null;

  return (
    <View style={styles.wrap}>
      {preview ? (
        <Image
          source={{ uri: preview }}
          style={circle
            ? { width: size, height: size, borderRadius: size / 2, alignSelf: 'center' }
            : styles.previewRect}
        />
      ) : (
        <View style={[circle ? styles.circlePlaceholder : styles.rectPlaceholder]}>
          <Text style={styles.placeholderIcon}>{circle ? '👤' : '🖼️'}</Text>
        </View>
      )}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btn} onPress={async () => { const a = await takePhoto(circle); if (a) onChange(a); }}>
          <Text style={styles.btnText}>📷 Prendre</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={async () => { const a = await pickFromLibrary(circle); if (a) onChange(a); }}>
          <Text style={styles.btnText}>🖼️ Importer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  previewRect: { width: '100%', height: 180, borderRadius: 12, resizeMode: 'cover' },
  rectPlaceholder: {
    width: '100%', height: 140, borderRadius: 12, backgroundColor: '#e8edf3',
    alignItems: 'center', justifyContent: 'center',
  },
  circlePlaceholder: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#e8edf3',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  placeholderIcon: { fontSize: 38 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10, justifyContent: 'center' },
  btn: {
    borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.primary,
    paddingVertical: 9, paddingHorizontal: 16,
  },
  btnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
});
