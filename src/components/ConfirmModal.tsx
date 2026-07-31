import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, destructive && styles.confirmButtonDestructive]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { color: '#a1a1a6', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 22 },
  buttonsRow: { flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, backgroundColor: '#2c2c2e', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  confirmButton: { flex: 1, backgroundColor: '#0a84ff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  confirmButtonDestructive: { backgroundColor: '#ff3b30' },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
