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
import { checkIsOwner } from '../../utils/admin';
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

const GENEROS_DISPONIBLES = [
  'Reggaetón',
  'Electrónica',
  'Banda / Norteño',
  'Pop / Hits',
  'Hip-Hop',
  'Cumbia / Salsa',
  'Rock',
  'Techno / House',
];

const DINAMICAS_RAPIDAS = [
  'Mujeres no cover antes de las 11 PM',
  'Cumpleañeros botella gratis',
  '2x1 en copeo hasta las 10 PM',
  'Se permite descorche / BYOB',
  'Shots de bienvenida',
  'Concurso de disfraces',
];

interface SedeGuardada {
  lugar: string;
  direccion: string;
  latitud: number;
  longitud: number;
  link_logo: string | null;
  colores: string[] | null;
  tipo_fiesta: string;
}

const FORM_VACIO = {
  titulo: '',
  descripcion: '',
  lugar: '',
  direccion: '',
  tipoSeleccionado: TIPOS_FIESTA[0],
  coordenadas: { latitud: 22.7709, longitud: -102.5832 },
  fechaHora: new Date(),
  horaFin: '03:00 AM',
  tieneCover: false,
  esPorEtapas: false,
  precioPreventa: '',
  precioUnico: '',
  etapas: [{ precio: '', fechas: '' }],
  esByob: false,
  soloMayores: true,
  vestimenta: 'Casual · INE obligatoria',
  generos: [] as string[],
  dinamicas: [] as string[],
};

// -----------------------------------------------------------------------
// PANTALLA PRINCIPAL (Protegida solo para el propietario de la app)
// -----------------------------------------------------------------------
export default function CrearScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [verificando, setVerificando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  const [vista, setVista] = useState<'lista' | 'formulario'>(id ? 'formulario' : 'lista');
  const [idEdicion, setIdEdicion] = useState<string | null>(id ?? null);

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      checkIsOwner().then(({ isOwner }) => {
        if (!activo) return;
        setAutorizado(isOwner);
        setVerificando(false);
      });

      if (!id) {
        setVista('lista');
        setIdEdicion(null);
      } else {
        setVista('formulario');
        setIdEdicion(id);
      }

      return () => {
        activo = false;
      };
    }, [id])
  );

  if (verificando) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  if (!autorizado) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Acceso Restringido"
          subtitle="Panel exclusivo del propietario"
          right={<IconButton name="close" onPress={() => router.replace('/(tabs)')} />}
        />
        <View style={styles.centerContent}>
          <EmptyState
            icon="lock-closed-outline"
            title="Solo el administrador puede publicar fiestas"
            message="Inicia sesión con la cuenta de propietario para gestionar la cartelera de eventos."
            action={
              <Button
                title="Volver al Mapa"
                icon="map-outline"
                onPress={() => router.replace('/(tabs)')}
              />
            }
          />
        </View>
      </View>
    );
  }

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
// VISTA 1: LISTA DE FIESTAS PUBLICADAS
// -----------------------------------------------------------------------
function MiFiestaItemCard({
  item,
  onEditar,
}: {
  item: any;
  onEditar: () => void;
}) {
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
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
    const { data, error } = await supabase
      .from('eventos')
      .select('*')
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
        title="Panel de Propietario"
        subtitle="Publica eventos rápidos o edita la cartelera"
        right={<IconButton name="add" onPress={onCrearNueva} bg={C.brand} color="#fff" />}
      />

      <View style={{ paddingHorizontal: S.xl, marginBottom: S.md }}>
        <Button
          title="Publicar nueva fiesta"
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
            title="Aún no hay fiestas publicadas"
            message="Sube el primer evento y sus colores se extraerán automáticamente del logo."
          />
        </View>
      ) : (
        <FlatList
          data={fiestas}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MiFiestaItemCard item={item} onEditar={() => onEditar(String(item.id))} />
          )}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------
// VISTA 2: FORMULARIO RÁPIDO PARA EL PROPIETARIO
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
  const [sedesFrecuentes, setSedesFrecuentes] = useState<SedeGuardada[]>([]);

  const [titulo, setTitulo] = useState(FORM_VACIO.titulo);
  const [descripcion, setDescripcion] = useState(FORM_VACIO.descripcion);
  const [lugar, setLugar] = useState(FORM_VACIO.lugar);
  const [direccion, setDireccion] = useState(FORM_VACIO.direccion);
  const [tipoSeleccionado, setTipoSeleccionado] = useState(FORM_VACIO.tipoSeleccionado);
  const [coordenadas, setCoordenadas] = useState(FORM_VACIO.coordenadas);
  const [fechaHora, setFechaHora] = useState(new Date());
  const [horaFin, setHoraFin] = useState(FORM_VACIO.horaFin);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [mostrarPicker, setMostrarPicker] = useState(false);

  const [tieneCover, setTieneCover] = useState(FORM_VACIO.tieneCover);
  const [esPorEtapas, setEsPorEtapas] = useState(FORM_VACIO.esPorEtapas);
  const [precioPreventa, setPrecioPreventa] = useState(FORM_VACIO.precioPreventa);
  const [precioUnico, setPrecioUnico] = useState(FORM_VACIO.precioUnico);
  const [etapas, setEtapas] = useState(FORM_VACIO.etapas);

  const [esByob, setEsByob] = useState(FORM_VACIO.esByob);
  const [soloMayores, setSoloMayores] = useState(FORM_VACIO.soloMayores);
  const [vestimenta, setVestimenta] = useState(FORM_VACIO.vestimenta);
  const [generos, setGeneros] = useState<string[]>(FORM_VACIO.generos);
  const [dinamicas, setDinamicas] = useState<string[]>(FORM_VACIO.dinamicas);
  const [nuevaDinamicaTexto, setNuevaDinamicaTexto] = useState('');

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
      setDescripcion(FORM_VACIO.descripcion);
      setLugar(FORM_VACIO.lugar);
      setDireccion(FORM_VACIO.direccion);
      setTipoSeleccionado(FORM_VACIO.tipoSeleccionado);
      setCoordenadas(FORM_VACIO.coordenadas);
      setFechaHora(new Date());
      setHoraFin(FORM_VACIO.horaFin);
      setTieneCover(FORM_VACIO.tieneCover);
      setEsPorEtapas(FORM_VACIO.esPorEtapas);
      setPrecioPreventa(FORM_VACIO.precioPreventa);
      setPrecioUnico(FORM_VACIO.precioUnico);
      setEtapas([{ precio: '', fechas: '' }]);
      setEsByob(FORM_VACIO.esByob);
      setSoloMayores(FORM_VACIO.soloMayores);
      setVestimenta(FORM_VACIO.vestimenta);
      setGeneros([]);
      setDinamicas([]);
      setNuevaDinamicaTexto('');
      setLinkLogo(null);
      setColoresExtraidos(null);
    };

    const cargarSedesPrevias = async () => {
      const { data } = await supabase
        .from('eventos')
        .select('lugar, direccion, latitud, longitud, link_logo, colores, tipo_fiesta')
        .order('fecha_hora', { ascending: false })
        .limit(40);

      if (!data || cancelado) return;
      const vistas = new Set<string>();
      const unicas: SedeGuardada[] = [];

      for (const row of data) {
        const key = (row.lugar || '').trim().toLowerCase();
        if (!key || vistas.has(key)) continue;
        vistas.add(key);
        unicas.push({
          lugar: row.lugar,
          direccion: row.direccion || '',
          latitud: Number(row.latitud) || 22.7709,
          longitud: Number(row.longitud) || -102.5832,
          link_logo: row.link_logo || null,
          colores: Array.isArray(row.colores) ? row.colores : null,
          tipo_fiesta: row.tipo_fiesta || 'Antro',
        });
      }
      setSedesFrecuentes(unicas);
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
      cargarSedesPrevias();

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

        setTitulo(data.titulo ?? '');
        setDescripcion(data.descripcion ?? '');
        setLugar(data.lugar ?? '');
        setDireccion(data.direccion ?? '');
        setCoordenadas({ latitud: Number(data.latitud), longitud: Number(data.longitud) });
        setFechaHora(new Date(data.fecha_hora));
        setHoraFin(data.hora_fin ?? '03:00 AM');
        setTieneCover(!!data.tiene_cover);
        setPrecioPreventa(data.precio_preventa ?? '');
        setEsByob(!!data.es_byob);
        setSoloMayores(data.solo_mayores !== undefined ? !!data.solo_mayores : true);
        setVestimenta(data.vestimenta ?? 'Casual · INE obligatoria');
        setGeneros(Array.isArray(data.generos) ? data.generos : []);
        setDinamicas(Array.isArray(data.dinamicas) ? data.dinamicas : []);
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

  const aplicarSedeRapida = (sede: SedeGuardada) => {
    tap();
    setLugar(sede.lugar);
    if (sede.direccion) setDireccion(sede.direccion);
    setCoordenadas({ latitud: sede.latitud, longitud: sede.longitud });
    if (sede.link_logo) setLinkLogo(sede.link_logo);
    if (sede.colores) setColoresExtraidos(sede.colores);
    const tipoObj = TIPOS_FIESTA.find((t) => t.label === sede.tipo_fiesta);
    if (tipoObj) setTipoSeleccionado(tipoObj);
    showToast(`Sede "${sede.lugar}" cargada (mapa, dirección y logo)`, 'info');
  };

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

  const toggleGenero = (gen: string) => {
    tap();
    setGeneros((prev) =>
      prev.includes(gen) ? prev.filter((g) => g !== gen) : [...prev, gen]
    );
  };

  const toggleDinamica = (promo: string) => {
    tap();
    setDinamicas((prev) =>
      prev.includes(promo) ? prev.filter((d) => d !== promo) : [...prev, promo]
    );
  };

  const agregarDinamicaPersonalizada = () => {
    const limpia = nuevaDinamicaTexto.trim();
    if (!limpia) return;
    tap();
    if (!dinamicas.includes(limpia)) {
      setDinamicas([...dinamicas, limpia]);
    }
    setNuevaDinamicaTexto('');
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
      showToast('Completa el título y el nombre del lugar.', 'error');
      return;
    }
    if (tieneCover && !esPorEtapas && !precioUnico.trim()) {
      showToast('Indicaste que hay cover, agrega el precio general.', 'error');
      return;
    }

    setPublicando(true);

    const infoCover = tieneCover
      ? esPorEtapas
        ? JSON.stringify(etapas)
        : precioUnico.trim()
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

    const payloadExtendido: Record<string, any> = {
      ...payloadBase,
      descripcion: descripcion.trim() || null,
      direccion: direccion.trim() || null,
      hora_fin: horaFin.trim() || null,
      precio_preventa: tieneCover && !esPorEtapas && precioPreventa.trim() ? precioPreventa.trim() : null,
      vestimenta: vestimenta.trim() || null,
      generos,
      dinamicas,
      ...(coloresExtraidos ? { colores: coloresExtraidos } : {}),
    };

    const ejecutarGuardado = async (payload: Record<string, any>) => {
      if (esEdicion && idEdicion) {
        return await supabase.from('eventos').update(payload).eq('id', idEdicion);
      } else {
        return await supabase
          .from('eventos')
          .insert([{ ...payload, creador_id: userId }]);
      }
    };

    let { error: errorDB } = await ejecutarGuardado(payloadExtendido);

    // Si aún no has corrido la migración SQL de las columnas nuevas, guarda con las columnas base para no bloquear
    if (errorDB && /column|schema cache/i.test(String(errorDB.message || ''))) {
      const retry = await ejecutarGuardado(payloadBase);
      errorDB = retry.error;
    }

    setPublicando(false);

    if (errorDB) {
      showToast('No se pudo guardar', 'error', errorDB.message);
    } else {
      showToast(esEdicion ? 'Fiesta actualizada 🛠️' : '¡Fiesta publicada! 🎉', 'success');
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
        title={esEdicion ? 'Editar Fiesta' : 'Nueva Fiesta'}
        subtitle={
          esEdicion
            ? 'Modifica cualquier detalle de la ficha'
            : 'Elige una sede frecuente o llena los datos'
        }
        right={<IconButton name="close" onPress={onVolver} />}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Atajo de Sedes Frecuentes para subir eventos de Jueves/Viernes/Sábado en 1 toque */}
        {!esEdicion && sedesFrecuentes.length > 0 && (
          <Card style={styles.sectionCard}>
            <SectionLabel>⚡ Sedes Frecuentes (1 toque autorrellena lugar, mapa y logo)</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {sedesFrecuentes.map((sede) => (
                <TouchableOpacity
                  key={sede.lugar}
                  style={[
                    styles.sedeQuickChip,
                    lugar === sede.lugar && {
                      borderColor: colorAcento,
                      backgroundColor: alpha(colorAcento, 0.18),
                    },
                  ]}
                  onPress={() => aplicarSedeRapida(sede)}
                  activeOpacity={0.8}
                >
                  {sede.link_logo ? (
                    <Image source={{ uri: sede.link_logo }} style={styles.sedeQuickLogo} />
                  ) : (
                    <Ionicons name="location" size={16} color={colorAcento} />
                  )}
                  <Text style={T.bodyStrong}>{sede.lugar}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}

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
                  <Text style={T.bodyStrong}>Logo del evento</Text>
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
                <Text style={T.bodyStrong}>Seleccionar Logo o Flyer de la Galería</Text>
                <Text style={T.caption}>
                  Los colores de la fiesta se adaptarán automáticamente a tu imagen
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Card>

        {/* Información Básica y Horario */}
        <Card style={styles.sectionCard}>
          <SectionLabel>Nombre o Temática de la Fiesta</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="Ej. Viernes de Perreo / Noche Retro"
            placeholderTextColor={C.textFaint}
            value={titulo}
            onChangeText={setTitulo}
          />

          <SectionLabel style={{ marginTop: S.lg }}>Descripción breve (Opcional)</SectionLabel>
          <TextInput
            style={[styles.input, { minHeight: 68, textAlignVertical: 'top' }]}
            placeholder="DJ invitado, temática especial, reservaciones..."
            placeholderTextColor={C.textFaint}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
          />

          <SectionLabel style={{ marginTop: S.lg }}>Tipo de Lugar / Evento</SectionLabel>
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

          <SectionLabel style={{ marginTop: S.lg }}>Fecha, Hora de Inicio y Fin</SectionLabel>
          <View style={styles.fechasRow}>
            <TouchableOpacity style={styles.dateButton} onPress={() => abrirPicker('date')}>
              <Ionicons name="calendar-outline" size={18} color={colorAcento} />
              <Text style={T.bodyStrong}>
                {fechaHora.toLocaleDateString('es-MX', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
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

          <View style={{ marginTop: S.sm }}>
            <TextInput
              style={styles.input}
              placeholder="Hora de cierre (Ej. 03:00 AM)"
              placeholderTextColor={C.textFaint}
              value={horaFin}
              onChangeText={setHoraFin}
            />
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

        {/* Precios y Covers Claros */}
        <Card style={styles.sectionCard}>
          <SectionLabel>Precios y Cover</SectionLabel>

          <View style={styles.switchRow}>
            <Text style={T.bodyStrong}>💵 ¿Tiene Cover?</Text>
            <Switch
              value={tieneCover}
              onValueChange={setTieneCover}
              trackColor={{ false: C.surfaceHigh, true: colorAcento }}
              thumbColor="#fff"
            />
          </View>

          {!tieneCover ? (
            <Text style={[T.caption, { marginTop: S.sm }]}>
              Se mostrará como &quot;No Cover (Entrada Libre)&quot; en la ficha.
            </Text>
          ) : (
            <View style={styles.coverPanel}>
              <View style={styles.switchRowCover}>
                <Text style={T.body}>¿Venta por Fases / Etapas?</Text>
                <Switch
                  value={esPorEtapas}
                  onValueChange={setEsPorEtapas}
                  trackColor={{ false: C.surfaceHigh, true: colorAcento }}
                  thumbColor="#fff"
                />
              </View>
              {!esPorEtapas ? (
                <View style={{ marginTop: S.sm, gap: S.sm }}>
                  <View>
                    <Text style={[T.caption, { marginBottom: 4 }]}>
                      Precio Preventa (Opcional)
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej. 100 (deja vacío si no hay preventa)"
                      placeholderTextColor={C.textFaint}
                      keyboardType="numeric"
                      value={precioPreventa}
                      onChangeText={setPrecioPreventa}
                    />
                  </View>
                  <View>
                    <Text style={[T.caption, { marginBottom: 4 }]}>
                      Precio Cover General en Taquilla
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej. 150"
                      placeholderTextColor={C.textFaint}
                      keyboardType="numeric"
                      value={precioUnico}
                      onChangeText={setPrecioUnico}
                    />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: S.sm }}>
                  {etapas.map((etapa, index) => (
                    <View key={index} style={styles.etapaCard}>
                      <Text style={[styles.etapaTitle, { color: colorAcento }]}>
                        Fase {index + 1}
                      </Text>
                      <TextInput
                        style={styles.inputPequeno}
                        placeholder="Costo (Ej. 100)"
                        placeholderTextColor={C.textFaint}
                        keyboardType="numeric"
                        value={etapa.precio}
                        onChangeText={(text) => actualizarEtapa(index, 'precio', text)}
                      />
                      <TextInput
                        style={[styles.inputPequeno, { marginTop: 8 }]}
                        placeholder="Descripción (Ej. Preventa 1 / Antes de las 11 PM)"
                        placeholderTextColor={C.textFaint}
                        value={etapa.fechas}
                        onChangeText={(text) => actualizarEtapa(index, 'fechas', text)}
                      />
                    </View>
                  ))}
                  {etapas.length < 5 && (
                    <Button
                      title="+ Agregar Fase"
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
        </Card>

        {/* Dinámicas y Promociones */}
        <Card style={styles.sectionCard}>
          <SectionLabel>Dinámicas y Promociones de la Noche</SectionLabel>
          <Text style={[T.caption, { marginBottom: S.sm }]}>
            Toca para activar promociones rápidas o escribe una personalizada:
          </Text>

          <View style={styles.chipsWrap}>
            {DINAMICAS_RAPIDAS.map((promo) => {
              const active = dinamicas.includes(promo);
              return (
                <TouchableOpacity
                  key={promo}
                  onPress={() => toggleDinamica(promo)}
                  style={[
                    styles.selectableChip,
                    active && {
                      borderColor: colorAcento,
                      backgroundColor: alpha(colorAcento, 0.18),
                    },
                  ]}
                >
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'add-circle-outline'}
                    size={15}
                    color={active ? colorAcento : C.textMuted}
                  />
                  <Text
                    style={[
                      styles.selectableChipText,
                      active && { color: C.text, fontWeight: '700' },
                    ]}
                  >
                    {promo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.customPromoRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Otra dinámica (ej. Rifa de botella a medianoche)"
              placeholderTextColor={C.textFaint}
              value={nuevaDinamicaTexto}
              onChangeText={setNuevaDinamicaTexto}
              onSubmitEditing={agregarDinamicaPersonalizada}
            />
            <IconButton
              name="add"
              bg={colorAcento}
              color="#fff"
              onPress={agregarDinamicaPersonalizada}
            />
          </View>

          {dinamicas.length > 0 && (
            <View style={{ marginTop: S.sm, gap: 6 }}>
              {dinamicas.map((d) => (
                <View key={d} style={styles.activePromoRow}>
                  <Ionicons name="gift" size={15} color={colorAcento} />
                  <Text style={[T.caption, { color: C.text, flex: 1 }]}>{d}</Text>
                  <TouchableOpacity onPress={() => toggleDinamica(d)}>
                    <Ionicons name="close-circle" size={18} color={C.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Ambiente, Música y Requisitos */}
        <Card style={styles.sectionCard}>
          <SectionLabel>Géneros Musicales</SectionLabel>
          <View style={styles.chipsWrap}>
            {GENEROS_DISPONIBLES.map((gen) => {
              const active = generos.includes(gen);
              return (
                <TouchableOpacity
                  key={gen}
                  onPress={() => toggleGenero(gen)}
                  style={[
                    styles.selectableChip,
                    active && {
                      borderColor: colorAcento,
                      backgroundColor: alpha(colorAcento, 0.18),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectableChipText,
                      active && { color: colorAcento, fontWeight: '700' },
                    ]}
                  >
                    {gen}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <SectionLabel style={{ marginTop: S.lg }}>Código de Vestimenta / Requisitos</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="Ej. Casual / Semiformal · INE obligatoria"
            placeholderTextColor={C.textFaint}
            value={vestimenta}
            onChangeText={setVestimenta}
          />

          <View style={styles.switchRow}>
            <Text style={T.bodyStrong}>🍺 BYOB (Se permite descorche / tu bebida)</Text>
            <Switch
              value={esByob}
              onValueChange={setEsByob}
              trackColor={{ false: C.surfaceHigh, true: colorAcento }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={T.bodyStrong}>🔞 Solo +18 con identificación</Text>
            <Switch
              value={soloMayores}
              onValueChange={setSoloMayores}
              trackColor={{ false: C.surfaceHigh, true: colorAcento }}
              thumbColor="#fff"
            />
          </View>
        </Card>

        {/* Ubicación y Mapa */}
        <Card style={styles.sectionCard}>
          <SectionLabel>Lugar (Antro, Bar o Terraza)</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="Nombre del lugar (Ej. La Reina / Terraza Centro)"
            placeholderTextColor={C.textFaint}
            value={lugar}
            onChangeText={setLugar}
          />

          <SectionLabel style={{ marginTop: S.md }}>Dirección en texto</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="Ej. Av. Hidalgo #402, Centro Histórico"
            placeholderTextColor={C.textFaint}
            value={direccion}
            onChangeText={setDireccion}
          />

          <Text style={[T.caption, { marginTop: S.sm, marginBottom: S.sm }]}>
            Toca el mapa para fijar el pin exacto (para el botón de Google Maps):
          </Text>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.miniMap}
              region={{
                latitude: coordenadas.latitud,
                longitude: coordenadas.longitud,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
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
        </Card>

        <View style={{ gap: S.md, marginTop: S.sm }}>
          <Button
            title={esEdicion ? 'Guardar Cambios' : 'Publicar Fiesta'}
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
        message="¿Estás totalmente seguro? Esto borrará el evento y todos los mensajes del chat para siempre."
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
  sedeQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surfaceAlt,
    borderRadius: R.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  sedeQuickLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
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

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surfaceAlt,
    borderRadius: R.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  selectableChipText: {
    color: C.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  customPromoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginTop: S.md,
  },
  activePromoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.bg,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },

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
