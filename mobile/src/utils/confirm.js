import { Platform, Alert } from 'react-native';

/**
 * Confirmation cross-plateforme.
 * Sur le web, Alert.alert ne gère pas les boutons → on utilise window.confirm.
 */
export function confirmAction(title, message, onConfirm, confirmLabel = 'Confirmer') {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Notification simple cross-plateforme. */
export function notify(title, message = '') {
  if (Platform.OS === 'web') {
    // discret : on évite les popups bloquantes pour les simples confirmations
    console.log(`[${title}] ${message}`);
    return;
  }
  Alert.alert(title, message);
}
