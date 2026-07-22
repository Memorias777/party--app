import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../../supabase.js';
import { useFocusEffect } from 'expo-router';

export default function HistorialScreen() {
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [])
  );

  const cargarDatos = async () => {
    setCargando(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setUserId(user.id);
      
      const { data } = await supabase
        .from('participantes')
        .select(`
          evento_id,
          eventos ( titulo, lugar, fecha_hora, emoji ),
          historial_ia ( calificacion )
        `)
        .eq('perfil_id', user.id);
      
      // 🔥 Forzamos el tipo 'any' para evitar que TypeScript se ponga estricto con los arreglos relacionales
      const formateado = (data as any[])?.map((item: any) => {
        const eventoData = Array.isArray(item.eventos) ? item.eventos[0] : item.eventos;
        const historialData = Array.isArray(item.historial_ia) ? item.historial_ia[0] : item.historial_ia;

        return {
          id: item.evento_id,
          titulo: eventoData?.titulo || 'Fiesta',
          lugar: eventoData?.lugar || 'Ubicación oculta',
          emoji: eventoData?.emoji || '🎉',
          calificacion: historialData?.calificacion || 0,
        };
      }) || [];
      
      setHistorial(formateado);
    }
    setCargando(false);
  };

  const calificar = async (eventoId: string, estrellas: number) => {
    setHistorial(prev => prev.map(h => h.id === eventoId ? { ...h, calificacion: estrellas } : h));
    
    if (userId) {
      const { error } = await supabase.from('historial_ia').upsert({
        perfil_id: userId,
        evento_id: eventoId,
        calificacion: estrellas
      }, { onConflict: 'perfil_id,evento_id' }); 

      if (error) console.error('Error guardando calificación:', error.message);
    }
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff3b30" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mi Historial 🕓</Text>
      <FlatList
        data={historial}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>{item.emoji} {item.titulo}</Text>
            <Text style={styles.cardSub}>📍 {item.lugar}</Text>
            <View style={styles.estrellas}>
              {[1, 2, 3, 4, 5].map(estrella => (
                <TouchableOpacity key={estrella} onPress={() => calificar(item.id, estrella)}>
                  <Text style={styles.estrella}>{estrella <= item.calificacion ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: '#8e8e93', textAlign: 'center', marginTop: 40 }}>
            No has asistido a ninguna fiesta aún.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000', 
    paddingTop: 60, 
    paddingHorizontal: 20 
  },
  center: { 
    flex: 1, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  titulo: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 20 
  },
  card: { 
    backgroundColor: '#1c1c1e', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2c2c2e'
  },
  cardTitulo: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  cardSub: { 
    color: '#8e8e93', 
    marginTop: 4, 
    marginBottom: 12 
  },
  estrellas: { 
    flexDirection: 'row', 
    gap: 8 
  },
  estrella: { 
    fontSize: 28,
    color: '#ff3b30'
  }
});