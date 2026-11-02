import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ToastProvider } from '../components/Toast';
import { C } from '../constants/design';

export default function RootLayout() {
  return (
    <ToastProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        {/* Carga la carpeta de tabs por defecto */}
        <Stack.Screen name="(tabs)" />
        {/* Carga el login como una pantalla emergente */}
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack>
    </ToastProvider>
  );
}
