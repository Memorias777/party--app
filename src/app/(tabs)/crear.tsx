import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../../supabase.js';
import { router, useLocalSearchParams } from 'expo-router';

const TIPOS_FIESTA = [
  { label: 'Antro', emoji: '🪩' },
  { label: 'Callejoneada', emoji: '🤠' },
  { label: 'Norteño', emoji: '🌵' },
];

export default function CrearScreen() {
  // 🔥 Magia: Recibimos el ID (Si existe, estamos en MODO EDICIÓN)
  const { id } = useLocalSearchParams();
  const esEdicion = !!id;

  const [userId, setUserId] = useState<string | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(esEdicion); // Cargando solo si vamos a editar

  const [titulo, setTitulo] = useState('');
  const [lugar, setLugar] = useState('');
  const [tipoSeleccionado, setTipoSeleccionado] = useState(TIPOS_FIESTA[0]);
  const [coordenadas, setCoordenadas] = useState({ latitud: 22.7709, longitud: -102.5832 });
  
  const [fechaHora, setFechaHora] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [mostrarPicker, setMostrarPicker] = useState(false);

  const [tieneCover, setTieneCover] = useState(false);
  const [esPorEtapas, setEsPorEtapas] = useState(false);
  const [precioUnico, setPrecioUnico] = useState('');
  const [etapas, setEtapas] = useState([{ precio: '', fechas: '' }]);

  const [esByob, setEsByob] = useState(false);
  const [soloMayores, setSoloMayores] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  // 1. Obtener usuario y (si es edición) rellenar los datos de la fiesta
  useEffect(() => {
    const inicializarPantalla = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Acceso Denegado', 'Necesitas iniciar sesión.');
        router.replace('/login');
        return;
      }
      setUserId(user.id);

      // Si estamos en MODO EDICIÓN, descargamos los datos de la fiesta
      if (esEdicion) {
        const { data, error } = await supabase
          .from('eventos')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          Alert.alert('Error', 'No se pudo cargar la fiesta para editar.');
          router.back();
        } else if (data) {
          // Seguridad: Si no eres el creador, pa' fuera
          if (data.creador_id !== user.id) {
            Alert.alert('Acceso Denegado', 'Solo el creador puede editar esta fiesta.');
            router.back();
            return;
          }

          // Rellenamos los campos con la info de la base de datos
          setTitulo(data.titulo);
          setLugar(data.lugar);
          setCoordenadas({ latitud: data.latitud, longitud: data.longitud });
          setFechaHora(new Date(data.fecha_hora));
          setTieneCover(data.tiene_cover);
          setEsByob(data.es_byob);
          setSoloMayores(data.solo_mayores);
          
          const tipoObj = TIPOS_FIESTA.find(t => t.label === data.tipo_fiesta) || TIPOS_FIESTA[0];
          setTipoSeleccionado(tipoObj);

          if (data.tiene_cover && data.info_cover) {
            try {
              // Intentamos ver si la info_cover es un arreglo (Etapas)
              const coverParseado = JSON.parse(data.info_cover);
              if (Array.isArray(coverParseado)) {
                setEsPorEtapas(true);
                setEtapas(coverParseado);
              } else {
                setPrecioUnico(data.info_cover);
              }
            } catch (e) {
              // Si falla el JSON.parse, significa que es precio único normal
              setEsPorEtapas(false);
              setPrecioUnico(data.info_cover);
            }
          }
        }
        setCargandoDatos(false);
      }
    };

    inicializarPantalla();
  }, [id]);

  const onChangeFecha = (event: any, selectedDate?: Date) => {
    setMostrarPicker(Platform.OS === 'ios');
    if (selectedDate) setFechaHora(selectedDate);
  };

  const abrirPicker = (mode: 'date' | 'time') => {
    setPickerMode(mode);
    setMostrarPicker(true);
  };

  const agregarEtapa = () => {
    if (etapas.length < 5) setEtapas([...etapas, { precio: '', fechas: '' }]);
    else Alert.alert('Límite alcanzado', 'Solo puedes agregar 5 etapas máximo.');
  };

  const actualizarEtapa = (index: number, campo: 'precio' | 'fechas', valor: string) => {
    const nuevasEtapas = [...etapas];
    nuevasEtapas[index][campo] = valor;
    setEtapas(nuevasEtapas);
  };

  // 🔥 2. Guardar Cambios (Update) o Crear Nueva (Insert)
  const guardarFiesta = async () => {
    if (!titulo.trim() || !lugar.trim()) {
      Alert.alert('Falta información', 'Por favor completa el título y el lugar.');
      return;
    }

    if (tieneCover && !esPorEtapas && !precioUnico.trim()) {
      Alert.alert('Falta el Cover', 'Indicaste que hay cover, por favor ingresa el precio total.');
      return;
    }

    setPublicando(true);

    const infoCover = tieneCover
      ? esPorEtapas
        ? JSON.stringify(etapas)
        : precioUnico
      : 'Sin Cover';

    const payloadEvento = {
      titulo,
      lugar,
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
      fecha_hora: fechaHora.toISOString(),
      tiene_cover: tieneCover,
      info_cover: infoCover,
      es_byob: esByob,
      solo_mayores: soloMayores,
      emoji: tipoSeleccionado.emoji,
      tipo_fiesta: tipoSeleccionado.label,
    };

    let errorDB = null;

    if (esEdicion) {
      // MODO EDICIÓN: Actualizamos la fiesta existente
      const { error } = await supabase
        .from('eventos')
        .update(payloadEvento)
        .eq('id', id);
      errorDB = error;
    } else {
      // MODO CREACIÓN: Insertamos una nueva
      const { error } = await supabase
        .from('eventos')
        .insert([{ ...payloadEvento, creador_id: userId }]);
      errorDB = error;
    }

    setPublicando(false);

    if (errorDB) {
      Alert.alert('Error', errorDB.message);
    } else {
      Alert.alert('¡Éxito!', esEdicion ? 'Fiesta actualizada correctamente. 🛠️' : '¡Fiesta Creada! 🎉');
      router.push('/(tabs)');
    }
  };

  // 🔥 3. El Botón del Pánico (Eliminar Fiesta)
  const eliminarFiesta = () => {
    Alert.alert(
      "Eliminar Fiesta",
      "¿Estás totalmente seguro? Esto borrará el evento, los asistentes y todos los mensajes del chat para siempre.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Eliminar", 
          style: "destructive",
          onPress: async () => {
            setEliminando(true);
            const { error } = await supabase.from('eventos').delete().eq('id', id);
            setEliminando(false);

            if (error) {
              Alert.alert('Error', 'No se pudo eliminar la fiesta.');
            } else {
              Alert.alert('Eliminada', 'La fiesta fue borrada del mapa.');
              router.push('/(tabs)');
            }
          }
        }
      ]
    );
  };

  // Pantalla de carga mientras trae los datos para editar
  if (cargandoDatos) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ff3b30" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{esEdicion ? 'Editar Fiesta 🛠️' : 'Crear Fiesta 🎉'}</Text>
      <Text style={styles.subheader}>{esEdicion ? 'Modifica los detalles del evento' : 'Configura los detalles del evento'}</Text>

      <Text style={styles.label}>Título de la fiesta</Text>
      <TextInput style={styles.input} placeholder="Ej. Noche de Rock" placeholderTextColor="#8e8e93" value={titulo} onChangeText={setTitulo} />

      <Text style={styles.label}>Tipo de Evento</Text>
      <View style={styles.tiposRow}>
        {TIPOS_FIESTA.map((tipo) => (
          <TouchableOpacity key={tipo.label} style={[styles.tipoBoton, tipoSeleccionado.label === tipo.label && styles.tipoBotonActivo]} onPress={() => setTipoSeleccionado(tipo)} activeOpacity={0.7}>
            <Text style={styles.tipoTextoEmoji}>{tipo.emoji}</Text>
            <Text style={[styles.tipoTexto, tipoSeleccionado.label === tipo.label && styles.tipoTextoActivo]}>{tipo.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Ubicación</Text>
      <TextInput style={styles.input} placeholder="Nombre del lugar (Ej. Plaza de Armas)" placeholderTextColor="#8e8e93" value={lugar} onChangeText={setLugar} />
      <Text style={styles.hintText}>Toca el mapa para fijar el punto exacto:</Text>
      <View style={styles.mapContainer}>
        <MapView style={styles.miniMap} initialRegion={{ latitude: coordenadas.latitud, longitude: coordenadas.longitud, latitudeDelta: 0.02, longitudeDelta: 0.02 }} onPress={(e) => setCoordenadas({ latitud: e.nativeEvent.coordinate.latitude, longitud: e.nativeEvent.coordinate.longitude })}>
          <Marker coordinate={{ latitude: coordenadas.latitud, longitude: coordenadas.longitud }} />
        </MapView>
      </View>

      <Text style={styles.label}>Fecha y Hora</Text>
      <View style={styles.fechasRow}>
        <TouchableOpacity style={styles.dateButton} onPress={() => abrirPicker('date')}>
          <Text style={styles.dateButtonText}>🗓️ {fechaHora.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateButton} onPress={() => abrirPicker('time')}>
          <Text style={styles.dateButtonText}>⏰ {fechaHora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Text>
        </TouchableOpacity>
      </View>

      {mostrarPicker && (
        <DateTimePicker value={fechaHora} mode={pickerMode} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onChangeFecha} themeVariant="dark" />
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>💵 Tiene Cover</Text>
        <Switch value={tieneCover} onValueChange={setTieneCover} trackColor={{ false: '#3a3a3c', true: '#ff3b30' }} thumbColor="#fff" />
      </View>

      {tieneCover && (
        <View style={styles.coverPanel}>
          <View style={styles.switchRowCover}>
            <Text style={styles.switchLabel}>¿Venta por Etapas?</Text>
            <Switch value={esPorEtapas} onValueChange={setEsPorEtapas} trackColor={{ false: '#3a3a3c', true: '#ff3b30' }} thumbColor="#fff" />
          </View>
          {!esPorEtapas ? (
            <View style={{ marginTop: 10 }}>
              <TextInput style={styles.input} placeholder="Precio total (Ej. 150)" placeholderTextColor="#8e8e93" keyboardType="numeric" value={precioUnico} onChangeText={setPrecioUnico} />
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              {etapas.map((etapa, index) => (
                <View key={index} style={styles.etapaCard}>
                  <Text style={styles.etapaTitle}>Etapa {index + 1}</Text>
                  <TextInput style={styles.inputPequeño} placeholder="Costo (Ej. 100)" placeholderTextColor="#8e8e93" value={etapa.precio} onChangeText={(text) => actualizarEtapa(index, 'precio', text)} />
                  <TextInput style={[styles.inputPequeño, { marginTop: 8 }]} placeholder="Límite (Ej. Hasta 15 de Oct)" placeholderTextColor="#8e8e93" value={etapa.fechas} onChangeText={(text) => actualizarEtapa(index, 'fechas', text)} />
                </View>
              ))}
              {etapas.length < 5 && (
                <TouchableOpacity style={styles.addEtapaButton} onPress={agregarEtapa}>
                  <Text style={styles.addEtapaText}>+ Agregar Etapa</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>🍺 BYOB (Trae tu bebida)</Text>
        <Switch value={esByob} onValueChange={setEsByob} trackColor={{ false: '#3a3a3c', true: '#ff3b30' }} thumbColor="#fff" />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>🔞 Solo +18</Text>
        <Switch value={soloMayores} onValueChange={setSoloMayores} trackColor={{ false: '#3a3a3c', true: '#ff3b30' }} thumbColor="#fff" />
      </View>

      {/* Botón Principal (Guardar o Crear) */}
      <TouchableOpacity style={[styles.publishButton, publicando && styles.publishButtonDisabled]} onPress={guardarFiesta} disabled={publicando} activeOpacity={0.85}>
        <Text style={styles.publishButtonText}>{publicando ? 'Procesando...' : (esEdicion ? '🛠️ Guardar Cambios' : '🚀 Crear Fiesta')}</Text>
      </TouchableOpacity>

      {/* 🔥 EL BOTÓN ROJO DE DESTRUCCIÓN (Solo aparece si estamos editando) */}
      {esEdicion && (
        <TouchableOpacity 
          style={[styles.deleteButton, eliminando && styles.publishButtonDisabled]} 
          onPress={eliminarFiesta} 
          disabled={eliminando} 
          activeOpacity={0.7}
        >
          <Text style={styles.deleteButtonText}>{eliminando ? 'Eliminando...' : '🗑️ Eliminar Fiesta'}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 24, paddingTop: 70, paddingBottom: 60 },
  header: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  subheader: { color: '#8e8e93', fontSize: 14, marginBottom: 20 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 18 },
  input: { backgroundColor: '#1c1c1e', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2c2c2e' },
  tiposRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  tipoBoton: { flex: 1, backgroundColor: '#1c1c1e', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2c2c2e' },
  tipoBotonActivo: { borderColor: '#ff3b30', backgroundColor: 'rgba(255, 59, 48, 0.1)' },
  tipoTextoEmoji: { fontSize: 24, marginBottom: 4 },
  tipoTexto: { color: '#8e8e93', fontSize: 12, fontWeight: '600' },
  tipoTextoActivo: { color: '#ff3b30' },
  hintText: { color: '#8e8e93', fontSize: 12, marginTop: 6, marginBottom: 10 },
  mapContainer: { height: 180, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#2c2c2e' },
  miniMap: { flex: 1 },
  fechasRow: { flexDirection: 'row', gap: 12 },
  dateButton: { flex: 1, backgroundColor: '#1c1c1e', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2c2c2e' },
  dateButtonText: { color: '#fff', fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1c1c1e', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 14, borderWidth: 1, borderColor: '#2c2c2e' },
  switchRowCover: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  switchLabel: { color: '#fff', fontSize: 15 },
  coverPanel: { backgroundColor: '#151515', borderRadius: 14, padding: 16, marginTop: 10, borderWidth: 1, borderColor: '#2c2c2e' },
  etapaCard: { backgroundColor: '#1c1c1e', padding: 12, borderRadius: 10, marginBottom: 10 },
  etapaTitle: { color: '#ff3b30', fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  inputPequeño: { backgroundColor: '#2c2c2e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 14 },
  addEtapaButton: { paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ff3b30', borderRadius: 10, borderStyle: 'dashed' },
  addEtapaText: { color: '#ff3b30', fontWeight: 'bold' },
  publishButton: { backgroundColor: '#ff3b30', borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 32, shadowColor: '#ff3b30', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  publishButtonDisabled: { opacity: 0.6 },
  publishButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  // 🔥 Nuevo estilo para el botón de borrar
  deleteButton: { backgroundColor: 'transparent', borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: '#ff3b30' },
  deleteButtonText: { color: '#ff3b30', fontSize: 17, fontWeight: 'bold' },
});