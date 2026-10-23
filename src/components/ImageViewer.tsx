import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, StatusBar, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  url: string | null;
  onClose: () => void;
};

const MAX_SCALE = 5;

// -----------------------------------------------------------------------
// Visor de fotos a pantalla completa (tipo WhatsApp):
//  - Pellizcar para hacer zoom, doble toque para acercar/alejar.
//  - Con zoom: arrastrar para mover la foto.
//  - Sin zoom: deslizar hacia arriba/abajo para cerrar.
// -----------------------------------------------------------------------
export default function ImageViewer({ url, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const cerrar = () => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
    onClose();
  };

  // Limita el desplazamiento para que la foto no se salga de la pantalla
  const clamp = (v: number, s: number, size: number) => {
    'worklet';
    const max = (size * (s - 1)) / 2;
    return Math.min(Math.max(v, -max), max);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.8), MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        reset();
      } else {
        savedScale.value = scale.value;
        tx.value = withTiming(clamp(tx.value, scale.value, width));
        ty.value = withTiming(clamp(ty.value, scale.value, height));
        savedTx.value = clamp(tx.value, scale.value, width);
        savedTy.value = clamp(ty.value, scale.value, height);
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      } else {
        // Sin zoom: solo movimiento vertical para "deslizar y cerrar"
        ty.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        tx.value = withTiming(clamp(tx.value, savedScale.value, width));
        ty.value = withTiming(clamp(ty.value, savedScale.value, height));
        savedTx.value = clamp(tx.value, savedScale.value, width);
        savedTy.value = clamp(ty.value, savedScale.value, height);
      } else if (Math.abs(e.translationY) > 120 || Math.abs(e.velocityY) > 1000) {
        runOnJS(cerrar)();
      } else {
        ty.value = withTiming(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (savedScale.value > 1) {
        reset();
      } else {
        const s = 2.5;
        scale.value = withTiming(s);
        savedScale.value = s;
        // Acerca hacia el punto tocado
        const nx = clamp((width / 2 - e.x) * (s - 1), s, width);
        const ny = clamp((height / 2 - e.y) * (s - 1), s, height);
        tx.value = withTiming(nx);
        ty.value = withTiming(ny);
        savedTx.value = nx;
        savedTy.value = ny;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // El fondo se aclara mientras se desliza para cerrar
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: savedScale.value > 1 ? 1 : interpolate(Math.abs(ty.value), [0, 300], [1, 0.3], 'clamp'),
  }));

  return (
    <Modal
      visible={!!url}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cerrar}
    >
      <StatusBar barStyle="light-content" />
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.flex, imageStyle]}>
            {url && <Image source={{ uri: url }} style={styles.flex} contentFit="contain" transition={150} />}
          </Animated.View>
        </GestureDetector>
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 10 }]}
          onPress={cerrar}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
