import React, { useState, useCallback } from 'react';
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
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../../supabase.js';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TIPOS_FIESTA = [
  { label: 'Antro', emoji: '🪩' },
  { label: 'Callejoneada', emoji: '🤠' },
  { label: 'Norteño', emoji: '🌵' },
];

export default function CrearScreen() {
  // Parámetro de URL (por si venimos del engrane del chat)
  const { id } = useLocalSearchParams<{ id?: string }>();
  
  // 🔥 ESTADO DEL DASHBOARD
  const [vista, setVista] = useState<'lista' | 'formulario'>('lista');
  const [misFiestas, setMisFiestas] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  // 🔥 ESTADO DEL FORMULARIO ORIGINAL
  const [eventoEditandoId, setEventoEditandoId] = useState<string | null>(null);
  const esEdicion = !!eventoEditandoId;

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

  // 1. Cargar datos iniciales al entrar a la pantalla
  useFocusEffect(
    useCallback(() => {
      const inicializarPantalla = async () => {
        setCargandoDatos(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Acceso Denegado', 'Necesitas iniciar sesión.');
          router.replace('/login');
          return;
        }
        setUserId(user.id);
        
        // Cargamos la lista de fiestas para el dashboard
        await cargarListaFiestas(user.id);

        // Si entramos con un ID desde otra pantalla, abrimos el formulario en modo edición
        if (id) {
          await cargarFiestaParaEditar(id, user.id);
        } else {
          setVista('lista');
        }
        setCargandoDatos(false);
      };

      inicializarPantalla();
    }, [id])
  );

  const cargarListaFiestas = async (uid: string) => {
    const { data } = await supabase
      .from('eventos')
      .select('*')
      .eq('creador_id', uid)
      .order('fecha_hora', { ascending: false });
    
    setMisFiestas(data || []);
  };

  const limpiarFormulario = () => {
    setEventoEditandoId(null);
    setTitulo('');
    setLugar('');
    setTipoSeleccionado(TIPOS_FIESTA[0]);
    setCoordenadas({ latitud: 22.7709, longitud: -102.5832 });
    setFechaHora(new Date());
    setTieneCover(false);
    setEsPorEtapas(false);
    setPrecioUnico('');
    setEtapas([{ precio: '', fechas: '' }]);
    setEsByob(false);
    setSoloMayores(false);
  };

  const prepararNuevaFiesta = () => {
    limpiarFormulario();
    setVista('formulario');
    router.setParams({ id: '' }); // Limpiamos la URL
  };

  const cargarFiestaParaEditar = async (fiestaId: string, uid?: string) => {
    setCargandoDatos(true);
    const { data, error } = await supabase.from('eventos').select('*').eq('id', fiestaId).single();

    if (error || !data) {
      Alert.alert('Error', 'No se pudo cargar la fiesta para editar.');
      setVista('lista');
    } else {
      if (uid && data.creador_id !== uid) {
        Alert.alert('Acceso Denegado', 'Solo el creador puede editar esta fiesta.');
        setVista('lista');
        setCargandoDatos(false);
        return;
      }

      setEventoEditandoId(data.id);
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
          const coverParseado = JSON.parse(data.info_cover);
          if (Array.isArray(coverParseado)) {
            setEsPorEtapas(true);
            setEtapas(coverParseado);
          } else {
            setEsPorEtapas(false);
            setPrecioUnico(data.info_cover);
          }
        } catch (e) {
          setEsPorEtapas(false);
          setPrecioUnico(data.info_cover);
        }
      }
      setVista('formulario');
    }
    setCargandoDatos(false);
  };

  // Funciones del Formulario Original
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

  // 2. Guardar Cambios (Update) o Crear Nueva (Insert)
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
      const { error } = await supabase.from('eventos').update(payloadEvento).eq('id', eventoEditandoId);
      errorDB = error;
    } else {
      const { error } = await supabase.from('eventos').insert([{ ...payloadEvento, creador_id: userId }]);
      errorDB = error;
    }

    setPublicando(false);

    if (errorDB) {
      Alert.alert('Error', errorDB.message);
    } else {
      Alert.alert('¡Éxito!', esEdicion ? 'Fiesta actualizada correctamente. 🛠️' : '¡Fiesta Creada! 🎉');
      router.setParams({ id: '' });
      if (userId) await cargarListaFiestas(userId);
      setVista('lista');
    }
  };

  // 3. El Botón del Pánico (Eliminar Fiesta)
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
            const { error } = await supabase.from('eventos').delete().eq('id', eventoEditandoId);
            setEliminando(false);

            if (error) {
              Alert.alert('Error', 'No se pudo eliminar la fiesta.');
            } else {
              Alert.alert('Eliminada', 'La fiesta fue borrada del mapa.');
              router.setParams({ id: '' });
              if (userId) await cargarListaFiestas(userId);
              setVista('lista');
            }
          }
        }
      ]
    );
  };

  if (cargandoDatos) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ff3b30" />
      </View>
    );
  }

  // 🔥 VISTA DASHBOARD (Mis Fiestas)
  if (vista === 'lista') {
    return (
      <View style={styles.containerLista}>
        <View style={styles.headerLista}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/perfil')} style={styles.btnVolver}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.tituloSeccion}>Mis Fiestas</Text>
        </View>

        <TouchableOpacity style={styles.btnPrincipalDashboard} onPress={prepararNuevaFiesta} activeOpacity={0.8}>
          <Text style={styles.btnTextoDashboard}>🎉 Crear Nueva Fiesta</Text>
        </TouchableOpacity>

        <FlatList
          data={misFiestas}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.tarjeta} onPress={() => cargarFiestaParaEditar(item.id)} activeOpacity={0.7}>
              <View style={styles.tarjetaTop}>
                <Text style={styles.tarjetaEmoji}>{item.emoji || '🥳'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tarjetaTitulo}>{item.titulo}</Text>
                  <Text style={styles.tarjetaLugar}>📍 {item.lugar}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#8e8e93" />
              </View>
              <Text style={styles.tarjetaFecha}>
                🗓️ {new Date(item.fecha_hora).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.vacioContainer}>
              <Ionicons name="sad-outline" size={64} color="#3a3a3c" />
              <Text style={styles.vacioTexto}>No has creado ninguna fiesta aún.</Text>
            </View>
          }
        />
      </View>
    );
  }

  // 🔥 VISTA FORMULARIO (Tu código original)
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botón para regresar al Dashboard */}
      <TouchableOpacity 
        style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'center' }} 
        onPress={() => {
          router.setParams({ id: '' });
          setVista('lista');
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#ff3b30" />
        <Text style={{ color: '#ff3b30', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>Volver a mis fiestas</Text>
      </TouchableOpacity>

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

      <TouchableOpacity style={[styles.publishButton, publicando && styles.publishButtonDisabled]} onPress={guardarFiesta} disabled={publicando} activeOpacity={0.85}>
        <Text style={styles.publishButtonText}>{publicando ? 'Procesando...' : (esEdicion ? '🛠️ Guardar Cambios' : '🚀 Crear Fiesta')}</Text>
      </TouchableOpacity>

      {esEdicion && (
        <TouchableOpacity style={[styles.deleteButton, eliminando && styles.publishButtonDisabled]} onPress={eliminarFiesta} disabled={eliminando} activeOpacity={0.7}>
          <Text style={styles.deleteButtonText}>{eliminando ? 'Eliminando...' : '🗑️ Eliminar Fiesta'}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// Tus estilos intactos + Estilos del Dashboard
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
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
  deleteButton: { backgroundColor: 'transparent', borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: '#ff3b30' },
  deleteButtonText: { color: '#ff3b30', fontSize: 17, fontWeight: 'bold' },

  // 🔥 Estilos nuevos para el Dashboard (Lista)
  containerLista: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20, paddingTop: 60 },
  headerLista: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  btnVolver: { marginRight: 16, padding: 4, backgroundColor: '#1c1c1e', borderRadius: 20 },
  tituloSeccion: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  btnPrincipalDashboard: { backgroundColor: '#ff3b30', padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 24, shadowColor: '#ff3b30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnTextoDashboard: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  tarjeta: { backgroundColor: '#1c1c1e', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2c2c2e' },
  tarjetaTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tarjetaEmoji: { fontSize: 32, marginRight: 12 },
  tarjetaTitulo: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  tarjetaLugar: { color: '#8e8e93', fontSize: 14 },
  tarjetaFecha: { color: '#ff3b30', fontSize: 13, fontWeight: '600', marginTop: 4, borderTopWidth: 1, borderTopColor: '#2c2c2e', paddingTop: 10 },
  vacioContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  vacioTexto: { color: '#8e8e93', fontSize: 16, textAlign: 'center', marginTop: 16 },
});