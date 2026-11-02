import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui/kit';
import { C, R, S, T, shadow } from '../constants/design';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, shadow('#000', 12)]}>
          <Text style={[T.subtitle, styles.title]}>{title}</Text>
          <Text style={[T.caption, styles.message]}>{message}</Text>

          <View style={styles.buttonsRow}>
            <Button
              title={cancelText}
              variant="secondary"
              onPress={onCancel}
              style={{ flex: 1 }}
            />
            <Button
              title={confirmText}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.xxl,
  },
  card: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: R.xl,
    padding: S.xl,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  title: {
    marginBottom: S.sm,
    textAlign: 'center',
  },
  message: {
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: S.xl,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: S.sm,
  },
});
