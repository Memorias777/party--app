import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Zacatecas Party App',
          headerStyle: { backgroundColor: '#1c1c1e' },
          headerTintColor: '#fff'
        }} 
      />
    </Stack>
  );
}