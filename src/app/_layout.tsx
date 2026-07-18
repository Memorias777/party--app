import React from 'react';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Carga la carpeta de tabs por defecto */}
      <Stack.Screen name="(tabs)" />
      {/* Carga el login como una pantalla emergente */}
      <Stack.Screen name="login" options={{ presentation: 'modal' }} />
    </Stack>
  );
}