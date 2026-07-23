import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { discoverLantern } from '../../api';
import { useToast } from '../../components/ui/Toast';
import { AME } from '../../theme';

/**
 * Scan d'une Lanterne. La caméra n'est qu'un canal : le QR encode l'identifiant
 * de la Lanterne ; l'organe (Event Engine) orchestre la découverte (récompense
 * Wallet + cycle de vie) et garantit l'idempotence. Repli web = saisie manuelle.
 */
export default function LanternScanScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const lock = useRef(false);

  const isWeb = Platform.OS === 'web';

  async function reveal(lanternId) {
    const id = String(lanternId || '').trim();
    if (!id || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const res = await discoverLantern(id);
      if (res.data?.replayed) {
        toast('Vous avez déjà découvert cette lanterne');
        navigation.goBack();
      } else {
        toast('Lanterne découverte ! Récompense ajoutée à votre Wallet');
        navigation.navigate('WalletTab');
      }
    } catch (err) {
      Alert.alert('Découverte impossible', err.response?.data?.error || 'Cette lanterne n\u2019est pas accessible.');
      lock.current = false;
    } finally {
      setBusy(false);
    }
  }

  function ManualEntry() {
    return (
      <View style={styles.manualCard}>
        <Text style={styles.manualLabel}>Saisir le code de la lanterne</Text>
        <TextInput
          style={styles.input}
          value={manual}
          onChangeText={setManual}
          placeholder="Identifiant de la lanterne"
          placeholderTextColor={AME.colors.textMuted}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.manualBtn} onPress={() => reveal(manual)} disabled={busy} activeOpacity={0.9}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.manualBtnText}>Révéler la lanterne</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.bg, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} accessibilityLabel="Fermer">
          <Ionicons name="chevron-down" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scanner une lanterne</Text>
        <View style={styles.closeBtn} />
      </View>

      {isWeb ? (
        <View style={styles.centerArea}>
          <Ionicons name="qr-code-outline" size={48} color="rgba(255,255,255,0.6)" />
          <Text style={styles.hint}>Le scan par caméra est disponible sur mobile. En attendant, saisissez le code affiché sous la lanterne.</Text>
          <ManualEntry />
        </View>
      ) : !permission ? (
        <View style={styles.centerArea}><ActivityIndicator color="#fff" /></View>
      ) : !permission.granted ? (
        <View style={styles.centerArea}>
          <Ionicons name="camera-outline" size={48} color="rgba(255,255,255,0.6)" />
          <Text style={styles.hint}>Autorisez la caméra pour scanner les lanternes du quartier.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.9}>
            <Text style={styles.permBtnText}>Autoriser la caméra</Text>
          </TouchableOpacity>
          <ManualEntry />
        </View>
      ) : (
        <>
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={busy ? undefined : ({ data }) => reveal(data)}
            />
            <View style={styles.frame} />
          </View>
          <Text style={styles.scanHint}>Visez le QR de la lanterne</Text>
          <ManualEntry />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: AME.colors.primary },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: AME.spacing.md },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  cameraWrap: { margin: AME.spacing.md, aspectRatio: 1, borderRadius: AME.radius.xl, overflow: 'hidden', backgroundColor: '#000' },
  frame: {
    position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: AME.radius.lg,
  },
  scanHint: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: 14, marginTop: 4 },
  permBtn: { backgroundColor: AME.colors.accent, borderRadius: AME.radius.full, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontWeight: '700' },
  manualCard: { margin: AME.spacing.md, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: AME.radius.lg, padding: 16 },
  manualLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, color: AME.colors.text,
  },
  manualBtn: { backgroundColor: '#7C3AED', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  manualBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
