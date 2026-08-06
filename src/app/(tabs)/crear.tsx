import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../../supabase';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/Toast';
import { seleccionarYSubirImagen } from '../../utils/uploadImage';

const TIPOS_FIESTA = [
  { label: 'Antro', emoji: '🪩' },
  { label: 'Callejoneada', emoji: '🤠' },
  { label: 'Norteño', emoji: '🌵' },
];

const FORM_VACIO = {
  titulo: '',
  lugar: '',
  tipoSeleccionado: TIPOS_FIESTA[0],
  coordenadas: { latitud: 22.7709, longitud: -102.5832 },
  fechaHora: new Date(),
  tieneCover: false,
  esPorEtapas: false,
  precioUnico: '',
  etapas: [{ precio: '', fechas: '' }],
  esByob: false,
  soloMayores: false,
};

// -----------------------------------------------------------------------
// PANTALLA PRINCIPAL: decide si mostramos la LISTA o el FORMULARIO
// -----------------------------------------------------------------------
export default function CrearScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  // vista: 'lista' | 'formulario'
  // Si llegamos con un id en la URL (desde el engranaje del chat), vamos
  // directo al formulario en modo edición. Si no, siempre mostramos la lista.
  const [vista, setVista] = useState<'lista' | 'formulario'>(id ? 'formulario' : 'lista');
  const [idEdicion, setIdEdicion] = useState<string | null>(id ?? null);

  // Cada vez que esta pestaña recibe foco SIN un id en la URL, forzamos
  // la vista de lista y limpiamos cualquier id de edición que hubiera
  // quedado pegado. Esto es lo que arregla el bug de "edito una fiesta,
  // luego quiero crear otra y se guarda sobre la que edité".
  useFocusEffect(
    useCallback(() => {
      if (!id) {
        setVista('lista');
        setIdEdicion(null);
      } else {
        setVista('formulario');
        setIdEdicion(id);
      }
    }, [id])
  );

  const irACrearNueva = () => {
    setIdEdicion(null);
    setVista('formulario');
  };

  const irAEditar = (eventoId: string) => {
    setIdEdicion(eventoId);
    setVista('formulario');
  };

  const volverALista = () => {
    // Limpiamos también el parámetro de la URL para que no quede pegado
    router.setParams({ id: undefined });
    setIdEdicion(null);
    setVista('lista');
  };

  if (vista === 'formulario') {
    return <FormularioFiesta idEdicion={idEdicion} onVolver={volverALista} />;
  }

  return <ListaFiestas onCrearNueva={irACrearNueva} onEditar={irAEditar} />;
}

// -----------------------------------------------------------------------
// VISTA 1: LISTA DE TUS FIESTAS
// -----------------------------------------------------------------------
function ListaFiestas({
  onCrearNueva,
  onEditar,
}: {
  onCrearNueva: () => void;
  onEditar: (id: string) => void;
}) {
  const [fiestas, setFiestas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargarFiestas = useCallback(async () => {
    setCargando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }

    const { data, error } = await supabase
      .from('eventos')
      .select('*')
      .eq('creador_id', user.id)
      .order('fecha_hora', { ascending: false });

    if (!error && data) {
      setFiestas(data);
    }
    setCargando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarFiestas();
    }, [cargarFiestas])
  );

  const formatFecha = (fechaISO: string) => {
    try {
      const fecha = new Date(fechaISO);
      return fecha.toLocaleString('es-MX', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return fechaISO;
    }
  };

  const esPasada = (fechaISO: string) => new Date(fechaISO).getTime() < Date.now();

  return (
    <View style={styles.container}>
      <View style={styles.listHeaderWrap}>
        <Text style={styles.header}>Tus Fiestas 🎉</Text>
        <Text style={styles.subheader}>Crea una nueva o edita las que ya tienes</Text>
      </View>

      <TouchableOpacity style={styles.crearNuevaButton} activeOpacity={0.85} onPress={onCrearNueva}>
        <Ionicons name="add-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.crearNuevaButtonText}>Crear nueva fiesta</Text>
      </TouchableOpacity>

      {cargando ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#ff3b30" />
        </View>
      ) : fiestas.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyEmoji}>🎪</Text>
          <Text style={styles.emptyText}>Aún no has creado ninguna fiesta</Text>
        </View>
      ) : (
        <FlatList
          data={fiestas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.fiestaCard}
              activeOpacity={0.75}
              onPress={() => onEditar(item.id)}
            >
              <View style={styles.fiestaAvatar}>
                {item.link_logo ? (
                  <Image source={{ uri: item.link_logo }} style={styles.fiestaAvatarImage} />
                ) : (
                  <Text style={{ fontSize: 24 }}>{item.emoji || '🥳'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fiestaTitle} numberOfLines={1}>{item.titulo}</Text>
                <Text style={styles.fiestaSubtitle} numberOfLines={1}>
                  📍 {item.lugar} · {formatFecha(item.fecha_hora)}
                </Text>
                {esPasada(item.fecha_hora) && (
                  <View style={styles.badgePasada}>
                    <Text style={styles.badgePasadaText}>Finalizada</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#636366" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------
// VISTA 2: FORMULARIO (crear o editar, según idEdicion)
// -----------------------------------------------------------------------
function FormularioFiesta({ idEdicion, onVolver }: { idEdicion: string | null; onVolver: () => void }) {
  const esEdicion = !!idEdicion;
  const { showToast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(esEdicion);

  const [titulo, setTitulo] = useState(FORM_VACIO.titulo);
  const [lugar, setLugar] = useState(FORM_VACIO.lugar);
  const [tipoSeleccionado, setTipoSeleccionado] = useState(FORM_VACIO.tipoSeleccionado);
  const [coordenadas, setCoordenadas] = useState(FORM_VACIO.coordenadas);
  const [fechaHora, setFechaHora] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [tieneCover, setTieneCover] = useState(FORM_VACIO.tieneCover);
  const [esPorEtapas, setEsPorEtapas] = useState(FORM_VACIO.esPorEtapas);
  const [precioUnico, setPrecioUnico] = useState(FORM_VACIO.precioUnico);
  const [etapas, setEtapas] = useState(FORM_VACIO.etapas);
  const [esByob, setEsByob] = useState(FORM_VACIO.esByob);
  const [soloMayores, setSoloMayores] = useState(FORM_VACIO.soloMayores);
  const [linkLogo, setLinkLogo] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);

  // Cada vez que cambia idEdicion (o al montar), reseteamos TODO el formulario
  useEffect(() => {
    let cancelado = false;

    const resetFormulario = () => {
      setTitulo(FORM_VACIO.titulo);
      setLugar(FORM_VACIO.lugar);
      setTipoSeleccionado(FORM_VACIO.tipoSeleccionado);
      setCoordenadas(FORM_VACIO.coordenadas);
      setFechaHora(new Date());
      setTieneCover(FORM_VACIO.tieneCover);
      setEsPorEtapas(FORM_VACIO.esPorEtapas);
      setPrecioUnico(FORM_VACIO.precioUnico);
      setEtapas([{ precio: '', fechas: '' }]);
      setEsByob(FORM_VACIO.esByob);
      setSoloMayores(FORM_VACIO.soloMayores);
      setLinkLogo(null);
    };

    const inicializar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      if (cancelado) return;
      setUserId(user.id);

      resetFormulario();

      if (esEdicion && idEdicion) {
        setCargandoDatos(true);
        const { data, error } = await supabase
          .from('eventos')
          .select('*')
          .eq('id', idEdicion)
          .single();

        if (cancelado) return;

        if (error || !data) {
          showToast('No se pudo cargar la fiesta.', 'error');
          onVolver();
          return;
        }

        if (data.creador_id !== user.id) {
          showToast('Solo el creador puede editar esta fiesta.', 'error');
          onVolver();
          return;
        }

        setTitulo(data.titulo ?? '');
        setLugar(data.lugar ?? '');
        setCoordenadas({ latitud: data.latitud, longitud: data.longitud });
        setFechaHora(new Date(data.fecha_hora));
        setTieneCover(!!data.tiene_cover);
        setEsByob(!!data.es_byob);
        setSoloMayores(!!data.solo_mayores);
        setLinkLogo(data.link_logo ?? null);

        const tipoObj = TIPOS_FIESTA.find((t) => t.label === data.tipo_fiesta) || TIPOS_FIESTA[0];
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
        setCargandoDatos(false);
      } else {
        setCargandoDatos(false);
      }
    };

    inicializar();

    return () => {
      cancelado = true;
    };
  }, [idEdicion, esEdicion]);

  const handleSeleccionarLogo = async () => {
    try {
      setSubiendoLogo(true);
      const url = await seleccionarYSubirImagen('fotos-fiestas');
      if (url) {
        setLinkLogo(url);
        showToast('Logo cargado correctamente 🖼️', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al subir el logo', 'error');
    } finally {
      setSubiendoLogo(false);
    }
  };

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
    else showToast('Solo puedes agregar 5 etapas máximo.', 'info');
  };

  const actualizarEtapa = (index: number, campo: 'precio' | 'fechas', valor: string) => {
    const nuevasEtapas = [...etapas];
    nuevasEtapas[index] = { ...nuevasEtapas[index], [campo]: valor };
    setEtapas(nuevasEtapas);
  };

  const guardarFiesta = async () => {
    if (!titulo.trim() || !lugar.trim()) {
      showToast('Completa el título y el lugar.', 'error');
      return;
    }
    if (tieneCover && !esPorEtapas && !precioUnico.trim()) {
      showToast('Indicaste que hay cover, agrega el precio.', 'error');
      return;
    }

    setPublicando(true);

    const infoCover = tieneCover ? (esPorEtapas ? JSON.stringify(etapas) : precioUnico) : 'Sin Cover';

    const payloadEvento = {
      titulo: titulo.trim(),
      lugar: lugar.trim(),
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
      fecha_hora: fechaHora.toISOString(),
      tiene_cover: tieneCover,
      info_cover: infoCover,
      es_byob: esByob,
      solo_mayores: soloMayores,
      emoji: tipoSeleccionado.emoji,
      tipo_fiesta: tipoSeleccionado.label,
      link_logo: linkLogo,
    };

    let errorDB = null;

    // 🔥 Usamos el idEdicion recibido por props (NO un id de params que
    // pudiera haber quedado obsoleto), así siempre editamos/creamos lo correcto.
    if (esEdicion && idEdicion) {
      const { error } = await supabase.from('eventos').update(payloadEvento).eq('id', idEdicion);
      errorDB = error;
    } else {
      const { error } = await supabase
        .from('eventos')
        .insert([{ ...payloadEvento, creador_id: userId }]);
      errorDB = error;
    }

    setPublicando(false);

    if (errorDB) {
      showToast('No se pudo guardar', 'error', errorDB.message);
    } else {
      showToast(esEdicion ? 'Fiesta actualizada 🛠️' : '¡Fiesta creada! 🎉', 'success');
      onVolver();
      router.push('/(tabs)');
    }
  };

  const confirmarEliminar = () => setModalEliminar(true);

  const eliminarFiestaConfirmado = async () => {
    if (!idEdicion) return;
    setModalEliminar(false);
    setEliminando(true);
    const { error } = await supabase.from('eventos').delete().eq('id', idEdicion);
    setEliminando(false);

    if (error) {
      showToast('No se pudo eliminar la fiesta.', 'error');
    } else {
      showToast('Fiesta eliminada del mapa', 'success');
      onVolver();
    }
  };

  if (cargandoDatos) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#ff3b30" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={onVolver} style={styles.backRow} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#ff3b30" />
          <Text style={styles.backRowText}>Tus fiestas</Text>
        </TouchableOpacity>

        <Text style={styles.header}>{esEdicion ? 'Editar Fiesta 🛠️' : 'Crear Fiesta 🎉'}</Text>
        <Text style={styles.subheader}>
          {esEdicion ? 'Modifica los detalles del evento' : 'Configura los detalles del evento'}
        </Text>

        <Text style={styles.label}>Logo de la fiesta (opcional)</Text>
        <TouchableOpacity
          style={styles.logoPickerButton}
          onPress={handleSeleccionarLogo}
          disabled={subiendoLogo}
          activeOpacity={0.75}
        >
          {subiendoLogo ? (
            <View style={styles.logoLoadingBox}>
              <ActivityIndicator color="#ff3b30" size="small" />
              <Text style={styles.logoEmptyText}>Subiendo imagen a Supabase...</Text>
            </View>
          ) : linkLogo ? (
            <View style={styles.logoPreviewWrap}>
              <Image source={{ uri: linkLogo }} style={styles.logoPreviewImage} />
              <View style={styles.logoCambiarBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
                <Text style={styles.logoCambiarText}>Cambiar Logo</Text>
              </View>
            </View>
          ) : (
            <View style={styles.logoEmptyBox}>
              <Ionicons name="image-outline" size={28} color="#ff3b30" />
              <Text style={styles.logoEmptyText}>Seleccionar Logo de la Galería 🖼️</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Título de la fiesta</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. Noche de Rock"
          placeholderTextColor="#8e8e93"
          value={titulo}
          onChangeText={setTitulo}
        />

        <Text style={styles.label}>Tipo de Evento</Text>
        <View style={styles.tiposRow}>
          {TIPOS_FIESTA.map((tipo) => (
            <TouchableOpacity
              key={tipo.label}
              style={[styles.tipoBoton, tipoSeleccionado.label === tipo.label && styles.tipoBotonActivo]}
              onPress={() => setTipoSeleccionado(tipo)}
              activeOpacity={0.7}
            >
              <Text style={styles.tipoTextoEmoji}>{tipo.emoji}</Text>
              <Text style={[styles.tipoTexto, tipoSeleccionado.label === tipo.label && styles.tipoTextoActivo]}>
                {tipo.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Ubicación</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre del lugar (Ej. Plaza de Armas)"
          placeholderTextColor="#8e8e93"
          value={lugar}
          onChangeText={setLugar}
        />
        <Text style={styles.hintText}>Toca el mapa para fijar el punto exacto:</Text>
        <View style={styles.mapContainer}>
          <MapView
            style={styles.miniMap}
            initialRegion={{
              latitude: coordenadas.latitud,
              longitude: coordenadas.longitud,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            onPress={(e) =>
              setCoordenadas({
                latitud: e.nativeEvent.coordinate.latitude,
                longitud: e.nativeEvent.coordinate.longitude,
              })
            }
          >
            <Marker coordinate={{ latitude: coordenadas.latitud, longitude: coordenadas.longitud }} />
          </MapView>
        </View>

        <Text style={styles.label}>Fecha y Hora</Text>
        <View style={styles.fechasRow}>
          <TouchableOpacity style={styles.dateButton} onPress={() => abrirPicker('date')}>
            <Text style={styles.dateButtonText}>
              🗓️ {fechaHora.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateButton} onPress={() => abrirPicker('time')}>
            <Text style={styles.dateButtonText}>
              ⏰ {fechaHora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>

        {mostrarPicker && (
          <DateTimePicker
            value={fechaHora}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChangeFecha}
            themeVariant="dark"
          />
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
                <TextInput
                  style={styles.input}
                  placeholder="Precio total (Ej. 150)"
                  placeholderTextColor="#8e8e93"
                  keyboardType="numeric"
                  value={precioUnico}
                  onChangeText={setPrecioUnico}
                />
              </View>
            ) : (
              <View style={{ marginTop: 10 }}>
                {etapas.map((etapa, index) => (
                  <View key={index} style={styles.etapaCard}>
                    <Text style={styles.etapaTitle}>Etapa {index + 1}</Text>
                    <TextInput
                      style={styles.inputPequeño}
                      placeholder="Costo (Ej. 100)"
                      placeholderTextColor="#8e8e93"
                      value={etapa.precio}
                      onChangeText={(text) => actualizarEtapa(index, 'precio', text)}
                    />
                    <TextInput
                      style={[styles.inputPequeño, { marginTop: 8 }]}
                      placeholder="Límite (Ej. Hasta 15 de Oct)"
                      placeholderTextColor="#8e8e93"
                      value={etapa.fechas}
                      onChangeText={(text) => actualizarEtapa(index, 'fechas', text)}
                    />
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

        <TouchableOpacity
          style={[styles.publishButton, publicando && styles.publishButtonDisabled]}
          onPress={guardarFiesta}
          disabled={publicando}
          activeOpacity={0.85}
        >
          <Text style={styles.publishButtonText}>
            {publicando ? 'Procesando...' : esEdicion ? '🛠️ Guardar Cambios' : '🚀 Crear Fiesta'}
          </Text>
        </TouchableOpacity>

        {esEdicion && (
          <TouchableOpacity
            style={[styles.deleteButton, eliminando && styles.publishButtonDisabled]}
            onPress={confirmarEliminar}
            disabled={eliminando}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteButtonText}>{eliminando ? 'Eliminando...' : '🗑️ Eliminar Fiesta'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ConfirmModal
        visible={modalEliminar}
        title="Eliminar Fiesta"
        message="¿Estás totalmente seguro? Esto borrará el evento, los asistentes y todos los mensajes del chat para siempre."
        confirmText="Sí, Eliminar"
        destructive
        onCancel={() => setModalEliminar(false)}
        onConfirm={eliminarFiestaConfirmado}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 24, paddingTop: 70, paddingBottom: 60 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listHeaderWrap: { paddingHorizontal: 24, paddingTop: 70 },
  header: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  subheader: { color: '#8e8e93', fontSize: 14, marginBottom: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backRowText: { color: '#ff3b30', fontSize: 15, fontWeight: '600', marginLeft: 2 },
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
  // Lista de fiestas
  crearNuevaButton: { flexDirection: 'row', backgroundColor: '#ff3b30', marginHorizontal: 24, marginTop: 16, marginBottom: 20, borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#ff3b30', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  crearNuevaButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  fiestaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1c1e', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2c2c2e' },
  fiestaAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2c2c2e', alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 2, borderColor: '#ff3b30', overflow: 'hidden' },
  fiestaAvatarImage: { width: 50, height: 50, borderRadius: 25 },
  fiestaTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  fiestaSubtitle: { color: '#8e8e93', fontSize: 13 },
  badgePasada: { alignSelf: 'flex-start', backgroundColor: '#2c2c2e', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  badgePasadaText: { color: '#8e8e93', fontSize: 11, fontWeight: '600' },
  logoPickerButton: { backgroundColor: '#1c1c1e', borderRadius: 14, borderWidth: 1, borderColor: '#2c2c2e', borderStyle: 'dashed', overflow: 'hidden', marginVertical: 4 },
  logoEmptyBox: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 6 },
  logoLoadingBox: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoEmptyText: { color: '#8e8e93', fontSize: 13, fontWeight: '600' },
  logoPreviewWrap: { height: 120, alignItems: 'center', justifyContent: 'center', padding: 12 },
  logoPreviewImage: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#ff3b30' },
  logoCambiarBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: 'rgba(255,59,48,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  logoCambiarText: { color: '#ff3b30', fontSize: 12, fontWeight: 'bold' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#8e8e93', fontSize: 15 },
});
