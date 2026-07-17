import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../../supabase.js';

const EMOJIS_DISPONIBLES = ['🥳', '🍻', '🎶', '🔥', '🎉', '🍾', '🎸', '🕺'];

export default function CrearScreen() {
  const [titulo, setTitulo] = useState('');
  const [lugar, setLugar] = useState('');
  const [fechaHora, setFechaHora] = useState(new Date());
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [tieneCover, setTieneCover] = useState(false);
  const [esByob, setEsByob] = useState(false);
  const [soloMayores, setSoloMayores] = useState(false);
  const [emojiSeleccionado, setEmojiSeleccionado] = useState('🥳');
  const [publicando, setPublicando] = useState(false);

  const onChangeFecha = (event: any, selectedDate?: Date) => {
    setMostrarPicker(Platform.OS === 'ios');
    if (selectedDate) setFechaHora(selectedDate);
  };

  const publicarFiesta = async () => {
    if (!titulo.trim() || !lugar.trim()) {
      Alert.alert('Falta información', 'Por favor completa el título y el lugar.');
      return;
    }

    setPublicando(true);

    // Coordenadas simuladas cerca del centro de Zacatecas (ajusta con un selector de mapa real después)
    const latitud = 22.7709 + (Math.random() * 0.02 - 0.01);
    const longitud = -102.5832 + (Math.random() * 0.02 - 0.01);

    const { error } = await supabase.from('eventos').insert([
      {
        titulo,
        lugar,
        latitud,
        longitud,
        fecha_hora: fechaHora.toISOString(),
        tiene_cover: tieneCover,
        es_byob: esByob,
        solo_mayores: soloMayores,
        emoji: emojiSeleccionado,
      },
    ]);

    setPublicando(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('¡Publicada!', 'Tu fiesta ya está visible en el mapa 🎉');
      setTitulo('');
      setLugar('');
      setFechaHora(new Date());
      setTieneCover(false);
      setEsByob(false);
      setSoloMayores(false);
      setEmojiSeleccionado('🥳');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Crear Fiesta 🎉</Text>
      <Text style={styles.subheader}>Comparte tu evento con la ciudad</Text>

      {/* Selector de emoji */}
      <Text style={styles.label}>Ícono del pin</Text>
      <View style={styles.emojiRow}>
        {EMOJIS_DISPONIBLES.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.emojiOption,
              emojiSeleccionado === emoji && styles.emojiOptionSelected,
            ]}
            onPress={() => setEmojiSeleccionado(emoji)}
            activeOpacity={0.7}
          >
            <Text style={styles.emojiOptionText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Título */}
      <Text style={styles.label}>Título de la fiesta</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Noche de Mezcal en el Centro"
        placeholderTextColor="#8e8e93"
        value={titulo}
        onChangeText={setTitulo}
      />

      {/* Lugar */}
      <Text style={styles.label}>Lugar</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Plaza de Armas"
        placeholderTextColor="#8e8e93"
        value={lugar}
        onChangeText={setLugar}
      />

      {/* Fecha y hora */}
      <Text style={styles.label}>Fecha y hora</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setMostrarPicker(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.dateButtonText}>
          🗓️{' '}
          {fechaHora.toLocaleString('es-MX', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </TouchableOpacity>
      {mostrarPicker && (
        <DateTimePicker
          value={fechaHora}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeFecha}
          themeVariant="dark"
        />
      )}

      {/* Switches */}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>💵 Tiene cover</Text>
        <Switch
          value={tieneCover}
          onValueChange={setTieneCover}
          trackColor={{ false: '#3a3a3c', true: '#ff3b30' }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>🍺 BYOB (trae tu bebida)</Text>
        <Switch
          value={esByob}
          onValueChange={setEsByob}
          trackColor={{ false: '#3a3a3c', true: '#ff3b30' }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>🔞 Solo +18</Text>
        <Switch
          value={soloMayores}
          onValueChange={setSoloMayores}
          trackColor={{ false: '#3a3a3c', true: '#ff3b30' }}
          thumbColor="#fff"
        />
      </View>

      {/* Botón publicar */}
      <TouchableOpacity
        style={[styles.publishButton, publicando && styles.publishButtonDisabled]}
        onPress={publicarFiesta}
        disabled={publicando}
        activeOpacity={0.85}
      >
        <Text style={styles.publishButtonText}>
          {publicando ? 'Publicando...' : '🚀 Publicar Fiesta'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 24, paddingTop: 70, paddingBottom: 60 },
  header: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  subheader: { color: '#8e8e93', fontSize: 14, marginBottom: 28 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  dateButton: {
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  dateButtonText: { color: '#fff', fontSize: 15 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiOption: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2c2c2e',
  },
  emojiOptionSelected: {
    borderColor: '#ff3b30',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  emojiOptionText: { fontSize: 24 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  switchLabel: { color: '#fff', fontSize: 15 },
  publishButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  publishButtonDisabled: { opacity: 0.6 },
  publishButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});