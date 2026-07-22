import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

/**
 * Référence de navigation globale. Utile pour naviguer depuis des surfaces qui
 * vivent hors d'un navigateur (ex. bannière temps réel, bascule d'âme). À
 * utiliser avec parcimonie : la navigation par props reste la règle.
 */
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) navigationRef.navigate(name, params);
}

/**
 * Bascule Première ↔ Deuxième Âme sans démonter l'arbre de navigation.
 * Les deux faces sont des écrans frères (FirstSoul / SecondSoul) du ClientRoot.
 */
export function navigateToSoul(soul) {
  if (!navigationRef.isReady()) return;
  const routeName = soul === 'second' ? 'SecondSoul' : 'FirstSoul';
  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: routeName }],
    }),
  );
}
