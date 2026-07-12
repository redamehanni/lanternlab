import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProvider, useApp } from './src/context/AppContext';
import { CommunicationProvider } from './src/context/CommunicationContext';
import { CartProvider } from './src/context/CartContext';
import { ToastProvider } from './src/components/ui/Toast';
import { DriverProvider } from './src/context/DriverContext';
import AppNavigator from './src/navigation';
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
    <NavigationContainer>
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <CommunicationProvider>
        <DriverProvider>
          <CartProvider>
            <ToastProvider>
              <Root />
            </ToastProvider>
          </CartProvider>
        </DriverProvider>
        </CommunicationProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
