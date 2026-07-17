import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Button, Text, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../supabase.js';

export default function IndexScreen() {
  const [eventos, setEventos] = useState<any[]>([]);

  // Función para traer las fiestas de tu Supabase
  const fetchEventos = async () => {
    const { data, error } = await supabase.from('eventos').select('*');
    if (error) {
      console.log('Error trayendo eventos:', error);
    } else {
      setEventos(data);
    }
  };

  // Esto hace que se carguen los eventos en cuanto abres la app
  useEffect(() => {
    fetchEventos();
  }, []);

  // Función para crear una fiesta falsa rápida en el mapa
  const crearFiestaPrueba = async () => {
    // Generamos coordenadas un poco al azar alrededor del centro para que no se encimen
    const latRandom = 22.7709 + (Math.random() * 0.02 - 0.01);
    const lngRandom = -102.5832 + (Math.random() * 0.02 - 0.01);

    const { error } = await supabase.from('eventos').insert([
      {
        titulo: 'Fiesta Beta Creada desde App',
        lugar: 'Ubicación Secreta',
        latitud: latRandom,
        longitud: lngRandom,
        fecha_hora: new Date().toISOString(),
        tiene_cover: false,
        es_byob: true,
        solo_mayores: true
      }
    ]);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('¡Éxito!', 'Fiesta creada en la base de datos');
      fetchEventos(); // Recargamos el mapa para ver el pin nuevo
    }
  };

  return (
    <View style={styles.container}>
      {/* Mapa centrado en tu ciudad */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 22.7709,
          longitude: -102.5832,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Aquí pintamos un marcador por cada fiesta en la base de datos */}
        {eventos.map((ev: any) => (
          <Marker 
            key={ev.id} 
            coordinate={{ latitude: ev.latitud, longitude: ev.longitud }} 
            title={ev.titulo}
            description={ev.lugar}
          />
        ))}
      </MapView>

      {/* Interfaz fea pero funcional */}
      <View style={styles.uiContainer}>
        <Text style={styles.title}>Mapa de Eventos (Beta)</Text>
        <Text style={styles.counter}>Fiestas activas: {eventos.length}</Text>
        <Button title="Crear Fiesta de Prueba" onPress={crearFiestaPrueba} color="#ff3b30" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  uiContainer: {
    padding: 20,
    backgroundColor: '#1c1c1e',
    paddingBottom: 40, // Espacio para el iPhone/Android
  },
  title: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  counter: { color: '#8e8e93', marginBottom: 15 },
});