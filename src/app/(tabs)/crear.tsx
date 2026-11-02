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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../supabase';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/Toast';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FiestaGlow,
  IconButton,
  ScreenHeader,
  SectionLabel,
  tap,
} from '../../components/ui/kit';
import { C, R, S, T } from '../../constants/design';
import {
  alpha,
  extraerColoresDeImagen,
  paletaParaFiesta,
  useColoresFiesta,
} from '../../utils/colors';
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

  const [vista, setVista] = useState<'lista' | 'formulario'>(id ? 'formulario' : 'lista');
  const [idEdicion, setIdEdicion] = useState<string | null>(id ?? null);

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
// VISTA 1: LISTA DE TUS FIESTAS ORGANIZADAS
// -----------------------------------------------------------------------
function MiFiestaItemCard({ item, onEditar }: { item: any; onEditar: () => void }) {
  const colores = useColoresFiesta(item);
  const [colorAcento] = colores;
  const esPasada = new Date(item.fecha_hora).getTime() < Date.now();

  const formatFecha = (fechaISO: string) => {
    try {
      const fecha = new Date(fechaISO);
      return fecha.toLocaleString('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fechaISO;
    }
  };

  return (
    <Card
      onPress={onEditar}
      style={[styles.fiestaCard, { borderColor: alpha(colorAcento, 0.35) }]}
    >
      <FiestaGlow colores={colores} intensity={0.45} />
      <View style={[styles.fiestaAvatar, { borderColor: colorAcento }]}>
        {item.link_logo ? (
          <Image source={{ uri: item.link_logo }} style={styles.fiestaAvatarImage} />
        ) : (
          <Text style={{ fontSize: 24 }}>{item.emoji || '🥳'}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {item.tipo_fiesta ? <Chip label={item.tipo_fiesta} color={colorAcento} /> : null}
          {esPasada && <Chip label="Finalizada" color={C.textMuted} />}
        </View>
        <Text style={T.subtitle} numberOfLines={1}>
          {item.titulo}
        </Text>
        <Text style={T.caption} numberOfLines={1}>
          📍 {item.lugar} · {formatFecha(item.fecha_hora)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colorAcento} />
    </Card>
  );
}

function ListaFiestas({
  onCrearNueva,
  onEditar,
}: {
  onCrearNueva: () => void;
  onEditar: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
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

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Organizar"
        subtitle="Crea una nueva fiesta o edita las que ya tienes"
        right={<IconButton name="add" onPress={onCrearNueva} bg={C.brand} color="#fff" />}
      />

      <View style={{ paddingHorizontal: S.xl, marginBottom: S.md }}>
        <Button
          title="Crear nueva fiesta"
          icon="add-circle-outline"
          onPress={onCrearNueva}
        />
      </View>

      {cargando ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : fiestas.length === 0 ? (
        <View style={styles.centerContent}>
          <EmptyState
            icon="sparkles-outline"
            title="Aún no has creado ninguna fiesta"
            message="Sube el logo de tu evento y la app tomará automáticamente sus colores."
          />
        </View>
      ) : (
        <FlatList
          data={fiestas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MiFiestaItemCard item={item} onEditar={() => onEditar(item.id)} />
          )}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------
// VISTA 2: FORMULARIO (crear o editar, con extracción de colores del logo)
// -----------------------------------------------------------------------
function FormularioFiesta({
  idEdicion,
  onVolver,
}: {
  idEdicion: string | null;
  onVolver: () => void;
}) {
  const esEdicion = !!idEdicion;
  const insets = useSafeAreaInsets();
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
  const [coloresExtraidos, setColoresExtraidos] = useState<string[] | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);

  const paletaActiva =
    coloresExtraidos ??
    paletaParaFiesta({
      id: idEdicion ?? 'nueva',
      tipo_fiesta: tipoSeleccionado.label,
      link_logo: linkLogo,
    });
  const [colorAcento] = paletaActiva;

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
      setColoresExtraidos(null);
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
        if (Array.isArray(data.colores) && data.colores.length >= 2) {
          setColoresExtraidos(data.colores);
        } else if (data.link_logo) {
          extraerColoresDeImagen(data.link_logo).then((c) => {
            if (!cancelado && c) setColoresExtraidos(c);
          });
        }

        const tipoObj =
          TIPOS_FIESTA.find((t) => t.label === data.tipo_fiesta) || TIPOS_FIESTA[0];
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
          } catch {
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
        const extraidos = await extraerColoresDeImagen(url);
        if (extraidos) {
          setColoresExtraidos(extraidos);
        }
        showToast('Logo cargado y colores aplicados 🎨', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al subir el logo', 'error');
    } finally {
      setSubiendoLogo(false);
    }
  };

  const onChangeFecha = (_event: any, selectedDate?: Date) => {
    setMostrarPicker(Platform.OS === 'ios');
    if (selectedDate) setFechaHora(selectedDate);
  };

  const abrirPicker = (mode: 'date' | 'time') => {
    tap();
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

    const infoCover = tieneCover
      ? esPorEtapas
        ? JSON.stringify(etapas)
        : precioUnico
      : 'Sin Cover';

    const payloadBase: Record<string, any> = {
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

    const payloadConColores = coloresExtraidos
      ? { ...payloadBase, colores: coloresExtraidos }
      : payloadBase;

    const ejecutarGuardado = async (payload: Record<string, any>) => {
      if (esEdicion && idEdicion) {
        return await supabase.from('eventos').update(payload).eq('id', idEdicion);
      } else {
        return await supabase
          .from('eventos')
          .insert([{ ...payload, creador_id: userId }]);
      }
    };

    let { error: errorDB } = await ejecutarGuardado(payloadConColores);

    // Si la columna `colores` aún no existe en Supabase, reintentamos sin ella
    if (errorDB && String(errorDB.message || '').toLowerCase().includes('colores')) {
      const retry = await ejecutarGuardado(payloadBase);
      errorDB = retry.error;
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
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FiestaGlow colores={paletaActiva} intensity={0.45} style={{ height: 280 }} />

      <ScreenHeader
        title={esEdicion ? 'Editar Fiesta' : 'Crear Fiesta'}
        subtitle={
          esEdicion ? 'Modifica los detalles del evento' : 'Configura los detalles del evento'
        }
        right={<IconButton name="close" onPress={onVolver} />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Selector de logo + vista previa de paleta extraída */}
        <Card style={[styles.sectionCard, { borderColor: alpha(colorAcento, 0.35) }]}>
          <SectionLabel>Logo y Colores de la Fiesta</SectionLabel>
          <TouchableOpacity
            style={[styles.logoPickerButton, { borderColor: alpha(colorAcento, 0.5) }]}
            onPress={handleSeleccionarLogo}
            disabled={subiendoLogo}
            activeOpacity={0.75}
          >
            {subiendoLogo ? (
              <View style={styles.logoLoadingBox}>
                <ActivityIndicator color={colorAcento} size="small" />
                <Text style={T.caption}>Subiendo imagen y extrayendo colores...</Text>
              </View>
            ) : linkLogo ? (
              <View style={styles.logoPreviewWrap}>
                <Image
                  source={{ uri: linkLogo }}
                  style={[styles.logoPreviewImage, { borderColor: colorAcento }]}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={T.bodyStrong}>Logo de la fiesta</Text>
                  <View style={styles.swatchesRow}>
                    {paletaActiva.map((hex, i) => (
                      <View
                        key={`${hex}-${i}`}
                        style={[styles.swatchDot, { backgroundColor: hex }]}
                      />
                    ))}
                    <Text style={T.caption}>Paleta activa</Text>
                  </View>
                </View>
                <Chip label="Cambiar" color={colorAcento} icon="camera" />
              </View>
            ) : (
              <View style={styles.logoEmptyBox}>
                <Ionicons name="image-outline" size={28} color={colorAcento} />
                <Text style={T.bodyStrong}>Seleccionar Logo de la Galería</Text>
                <Text style={T.caption}>
                  Los colores de la fiesta se adaptarán a tu imagen
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Card>

        <Card style={styles.sectionCard}>
          <SectionLabel>Título de la fiesta</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="Ej. Noche de Neon"
            placeholderTextColor={C.textFaint}
            value={titulo}
            onChangeText={setTitulo}
          />

          <SectionLabel style={{ marginTop: S.lg }}>Tipo de Evento</SectionLabel>
          <View style={styles.tiposRow}>
            {TIPOS_FIESTA.map((tipo) => {
              const active = tipoSeleccionado.label === tipo.label;
              return (
                <TouchableOpacity
                  key={tipo.label}
                  style={[
                    styles.tipoBoton,
                    active && {
                      borderColor: colorAcento,
                      backgroundColor: alpha(colorAcento, 0.16),
                    },
                  ]}
                  onPress={() => {
                    tap();
                    setTipoSeleccionado(tipo);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tipoTextoEmoji}>{tipo.emoji}</Text>
                  <Text
                    style={[
                      styles.tipoTexto,
                      active && { color: colorAcento, fontWeight: '700' },
                    ]}
                  >
                    {tipo.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <SectionLabel>Ubicación</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="Nombre del lugar (Ej. Plaza de Armas)"
            placeholderTextColor={C.textFaint}
            value={lugar}
            onChangeText={setLugar}
          />
          <Text style={[T.caption, { marginTop: S.sm, marginBottom: S.sm }]}>
            Toca el mapa para fijar el punto exacto:
          </Text>
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
              <Marker
                coordinate={{
                  latitude: coordenadas.latitud,
                  longitude: coordenadas.longitud,
                }}
              />
            </MapView>
          </View>

          <SectionLabel style={{ marginTop: S.lg }}>Fecha y Hora</SectionLabel>
          <View style={styles.fechasRow}>
            <TouchableOpacity style={styles.dateButton} onPress={() => abrirPicker('date')}>
              <Ionicons name="calendar-outline" size={18} color={colorAcento} />
              <Text style={T.bodyStrong}>
                {fechaHora.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateButton} onPress={() => abrirPicker('time')}>
              <Ionicons name="time-outline" size={18} color={colorAcento} />
              <Text style={T.bodyStrong}>
                {fechaHora.toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
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
        </Card>

        <Card style={styles.sectionCard}>
          <SectionLabel>Opciones y Acceso</SectionLabel>

          <View style={styles.switchRow}>
            <Text style={T.bodyStrong}>💵 Tiene Cover</Text>
            <Switch
              value={tieneCover}
              onValueChange={setTieneCover}
              trackColor={{ false: C.surfaceHigh, true: colorAcento }}
              thumbColor="#fff"
            />
          </View>

          {tieneCover && (
            <View style={styles.coverPanel}>
              <View style={styles.switchRowCover}>
                <Text style={T.body}>¿Venta por Etapas?</Text>
                <Switch
                  value={esPorEtapas}
                  onValueChange={setEsPorEtapas}
                  trackColor={{ false: C.surfaceHigh, true: colorAcento }}
                  thumbColor="#fff"
                />
              </View>
              {!esPorEtapas ? (
                <View style={{ marginTop: S.sm }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Precio total (Ej. 150)"
                    placeholderTextColor={C.textFaint}
                    keyboardType="numeric"
                    value={precioUnico}
                    onChangeText={setPrecioUnico}
                  />
                </View>
              ) : (
                <View style={{ marginTop: S.sm }}>
                  {etapas.map((etapa, index) => (
                    <View key={index} style={styles.etapaCard}>
                      <Text style={[styles.etapaTitle, { color: colorAcento }]}>
                        Etapa {index + 1}
                      </Text>
                      <TextInput
                        style={styles.inputPequeno}
                        placeholder="Costo (Ej. 100)"
                        placeholderTextColor={C.textFaint}
                        value={etapa.precio}
                        onChangeText={(text) => actualizarEtapa(index, 'precio', text)}
                      />
                      <TextInput
                        style={[styles.inputPequeno, { marginTop: 8 }]}
                        placeholder="Límite (Ej. Hasta 15 de Oct)"
                        placeholderTextColor={C.textFaint}
                        value={etapa.fechas}
                        onChangeText={(text) => actualizarEtapa(index, 'fechas', text)}
                      />
                    </View>
                  ))}
                  {etapas.length < 5 && (
                    <Button
                      title="+ Agregar Etapa"
                      variant="ghost"
                      color={colorAcento}
                      small
                      onPress={agregarEtapa}
                    />
                  )}
                </View>
              )}
            </View>
          )}

          <View style={styles.switchRow}>
            <Text style={T.bodyStrong}>🍺 BYOB (Trae tu bebida)</Text>
            <Switch
              value={esByob}
              onValueChange={setEsByob}
              trackColor={{ false: C.surfaceHigh, true: colorAcento }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={T.bodyStrong}>🔞 Solo +18</Text>
            <Switch
              value={soloMayores}
              onValueChange={setSoloMayores}
              trackColor={{ false: C.surfaceHigh, true: colorAcento }}
              thumbColor="#fff"
            />
          </View>
        </Card>

        <View style={{ gap: S.md, marginTop: S.sm }}>
          <Button
            title={esEdicion ? 'Guardar Cambios' : 'Crear Fiesta'}
            icon={esEdicion ? 'checkmark-circle-outline' : 'rocket-outline'}
            color={colorAcento}
            loading={publicando}
            onPress={guardarFiesta}
          />

          {esEdicion && (
            <Button
              title="Eliminar Fiesta"
              icon="trash-outline"
              variant="danger"
              loading={eliminando}
              onPress={confirmarEliminar}
            />
          )}
        </View>
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
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: S.xl, paddingTop: S.xs },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionCard: {
    padding: S.lg,
    marginBottom: S.md,
  },
  input: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    paddingVertical: 13,
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  tiposRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  tipoBoton: {
    flex: 1,
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  tipoTextoEmoji: { fontSize: 24, marginBottom: 4 },
  tipoTexto: { color: C.textMuted, fontSize: 12, fontWeight: '600' },

  mapContainer: {
    height: 180,
    borderRadius: R.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  miniMap: { flex: 1 },
  fechasRow: { flexDirection: 'row', gap: S.sm },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    paddingVertical: 12,
    marginTop: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  switchRowCover: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coverPanel: {
    backgroundColor: C.bg,
    borderRadius: R.md,
    padding: S.md,
    marginTop: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  etapaCard: {
    backgroundColor: C.surface,
    padding: S.md,
    borderRadius: R.md,
    marginBottom: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  etapaTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  inputPequeno: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
  },

  listContent: { paddingHorizontal: S.xl, paddingTop: S.xs },
  fiestaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: S.lg,
    marginBottom: S.md,
    gap: S.md,
  },
  fiestaAvatar: {
    width: 56,
    height: 56,
    borderRadius: R.lg,
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  fiestaAvatarImage: { width: '100%', height: '100%' },

  logoPickerButton: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  logoEmptyBox: {
    paddingVertical: S.xl,
    paddingHorizontal: S.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  logoLoadingBox: {
    paddingVertical: S.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoPreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: S.md,
    gap: S.md,
  },
  logoPreviewImage: {
    width: 64,
    height: 64,
    borderRadius: R.lg,
    borderWidth: 2,
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
