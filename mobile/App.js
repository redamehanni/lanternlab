import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/context/AppContext';
import { CommunicationProvider } from './src/context/CommunicationContext';
import { CartProvider } from './src/context/CartContext';
import { WalletProvider } from './src/context/WalletContext';
import { OpportunityProvider } from './src/context/OpportunityContext';
import { ToastProvider } from './src/components/ui/Toast';
import { DriverProvider } from './src/context/DriverContext';
import AppNavigator from './src/navigation';
import { navigationRef } from './src/navigation/navigationRef';
import { useAmeFonts } from './src/theme/fonts';
import { AME } from './src/theme';

function Root() {
  const { loading, activeSoul, user } = useApp();

  if (loading) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootBrand}>Ma Zone</Text>
        <ActivityIndicator size="small" color={AME.colors.accent} style={{ marginTop: 18 }} />
      </View>
    );
  }

  const barStyle = user?.role === 'client' && activeSoul === 'second' ? 'dark' : 'light';

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style={barStyle} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useAmeFonts();

  // Ne jamais bloquer l'app sur les fonts : si elles échouent (Expo Go / mismatch),
  // on continue avec les polices système — mieux qu'un écran blanc.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootBrandFallback}>Ma Zone</Text>
        <ActivityIndicator size="small" color={AME.colors.accent} style={{ marginTop: 18 }} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <CommunicationProvider>
          <DriverProvider>
            <CartProvider>
              <WalletProvider>
                <OpportunityProvider>
                  <ToastProvider>
                    <Root />
                  </ToastProvider>
                </OpportunityProvider>
              </WalletProvider>
            </CartProvider>
          </DriverProvider>
          </CommunicationProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AME.colors.bg,
  },
  bootBrand: {
    fontFamily: AME.fonts.display,
    fontSize: 34,
    color: AME.colors.text,
    letterSpacing: -0.5,
  },
  bootBrandFallback: {
    fontSize: 34,
    fontWeight: '600',
    color: AME.colors.text,
    letterSpacing: -0.5,
  },
});
