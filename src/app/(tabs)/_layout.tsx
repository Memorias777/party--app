import React, { useRef, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// -----------------------------------------------------------------------
// Gradiente animado (tipo "pintura líquida en movimiento") que cubre
// TODA la sección del tab activo, no solo un punto detrás del ícono.
// Los colores se desplazan en bucle mientras el tab esté seleccionado.
// -----------------------------------------------------------------------
const PALETAS_TAB = [
  ['#0FC2C0', '#F4D35E', '#EDEEC9'],
  ['#3A86FF', '#8AC926', '#FFCA3A'],
  ['#FF3B30', '#FF9F1C', '#FFD166'],
  ['#7B61FF', '#0FC2C0', '#FF6B9D'],
];

function TabBackgroundVivo({ focused, paletaIndex }: { focused: boolean; paletaIndex: number }) {
  const opacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: focused ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [focused, opacity]);

  useEffect(() => {
    if (!focused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shift, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(shift, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [focused, shift]);

  // 🔥 El gradiente interno mide el DOBLE del contenedor (120% de ancho extra
  // a cada lado) y solo se desplaza dentro de ese margen, así el borde del
  // gradiente nunca llega a quedar visible dentro del recorte del tab.
  const translateX = shift.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] });
  const colores = PALETAS_TAB[paletaIndex % PALETAS_TAB.length];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, borderRadius: 18, overflow: 'hidden' }]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -20,
          right: -20,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={[colores[0], colores[1], colores[2], colores[1], colores[0]] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.45)']}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function AnimatedTabIcon({
  name,
  focused,
  paletaIndex,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  paletaIndex: number;
}) {
  const scale = useRef(new Animated.Value(focused ? 1.08 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.08 : 1,
      useNativeDriver: true,
      bounciness: 10,
      speed: 14,
    }).start();
  }, [focused, scale]);

  return (
    <View style={styles.tabItemWrap}>
      <TabBackgroundVivo focused={focused} paletaIndex={paletaIndex} />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={name} size={22} color={focused ? '#fff' : '#6c6c8a'} />
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#6c6c8a',
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 92 : 68,
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, overflow: 'hidden' }}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={60} tint="dark" style={{ flex: 1 }} />
            ) : (
              <LinearGradient colors={['#16162a', '#0d0d18']} style={{ flex: 1 }} />
            )}
            <View style={styles.topBorder} />
          </View>
        ),
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '700',
          marginTop: -2,
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
            <AnimatedTabIcon name={focused ? 'map' : 'map-outline'} focused={focused} paletaIndex={0} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Fiestas',
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              focused={focused}
              paletaIndex={1}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name={focused ? 'time' : 'time-outline'} focused={focused} paletaIndex={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon name={focused ? 'person' : 'person-outline'} focused={focused} paletaIndex={3} />
          ),
        }}
      />
      <Tabs.Screen name="crear" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItemWrap: {
    width: 62,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});