import { CommonActions } from '@react-navigation/native';

/**
 * navigateToFreshHome — utilitaire de navigation client
 *
 * Responsabilité unique : ramener l'application dans un état d'accueil propre.
 *
 * - Navigue vers HomeTab → HomeMain → Home avec un paramètre `reset`
 *   (consommé par HomeScreen pour réinitialiser l'UI de recherche).
 * - Remet à zéro la stack CartTab (évite de retrouver OrderTracking livré/annulé).
 *
 * Ne contient aucune logique métier (commandes, panier, missions, sockets).
 * Réutilisable depuis n'importe quel écran client sans effet de bord métier.
 *
 * @param {import('@react-navigation/native').NavigationProp} navigation
 */
export function navigateToFreshHome(navigation) {
  const reset = Date.now();
  const tabNav = findClientTabNavigator(navigation);

  if (!tabNav) {
    navigation.navigate('HomeTab', {
      screen: 'HomeMain',
      params: { screen: 'Home', params: { reset } },
    });
    return;
  }

  const tabState = tabNav.getState();
  const homeTabIndex = tabState.routes.findIndex((r) => r.name === 'HomeTab');
  const routes = tabState.routes.map((route) => {
    if (route.name === 'HomeTab') {
      return {
        name: 'HomeTab',
        state: {
          index: 0,
          routes: [{
            name: 'HomeMain',
            state: {
              index: 0,
              routes: [{ name: 'Home', params: { reset } }],
            },
          }],
        },
      };
    }
    if (route.name === 'CartTab') {
      return {
        name: 'CartTab',
        state: {
          index: 0,
          routes: [{ name: 'Cart' }],
        },
      };
    }
    return route;
  });

  tabNav.dispatch(
    CommonActions.reset({
      index: homeTabIndex >= 0 ? homeTabIndex : 0,
      routes,
    }),
  );
}

/** Remonte l'arbre de navigation jusqu'au Tab navigator client (HomeTab + CartTab). */
function findClientTabNavigator(navigation) {
  let nav = navigation;
  while (nav) {
    const names = nav.getState?.()?.routeNames;
    if (names?.includes('HomeTab') && names?.includes('CartTab')) return nav;
    nav = nav.getParent?.();
  }
  return null;
}
