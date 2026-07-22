import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
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
import { COLORS } from './src/config';

function Root() {
  const { loading } = useApp();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
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
