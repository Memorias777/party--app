import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R } from '../../constants/design';
import { alpha } from '../../utils/colors';
import { tap } from '../../components/ui/kit';

function TabIcon({
  name,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) {
  return (
    <View style={[styles.tabItemWrap, focused && styles.tabItemWrapActive]}>
      <Ionicons name={name} size={22} color={focused ? C.brand : C.textFaint} />
    </View>
  );
}

export default function TabLayout() {
  // Respeta la barra de navegación del sistema (3 botones / gestos en Android,
  // home indicator en iOS) para que los tabs nunca queden debajo de ella.
  const insets = useSafeAreaInsets();
  const bottomInset =
    Platform.OS === 'ios'
      ? insets.bottom
      : // Android: inset del sistema (3 botones ≈ 48, gestos ≈ 16-24) + aire extra
        // para que los tabs no queden pegados a la barra de gestos.
        Math.max(insets.bottom + 10, 16);
  const TAB_BASE_HEIGHT = 60;

  return (
    <Tabs
      screenListeners={{
        tabPress: () => tap(),
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.textFaint,
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: TAB_BASE_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={styles.bgContainer}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(C.surface, 0.96) }]} />
            )}
            <View style={styles.topBorder} />
          </View>
        ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'map' : 'map-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Fiestas',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'time' : 'time-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="crear" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bgContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  tabItemWrap: {
    width: 54,
    height: 32,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemWrapActive: {
    backgroundColor: alpha(C.brand, 0.16),
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: C.border,
  },
});
