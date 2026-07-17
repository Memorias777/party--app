import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';

export interface Chat {
  id: string;
  emoji: string;
  nombreEvento: string;
  ultimoMensaje: string;
  hora: string;
  noLeidos: number;
}

const CHATS_MOCK: Chat[] = [
  {
    id: '1',
    emoji: '🥳',
    nombreEvento: 'Noche de Mezcal en el Centro',
    ultimoMensaje: '¡Nos vemos a las 10!',
    hora: '9:42 PM',
    noLeidos: 3,
  },
  {
    id: '2',
    emoji: '🎶',
    nombreEvento: 'Fiesta en la Alameda',
    ultimoMensaje: 'Trae algo de tomar 🍻',
    hora: '7:15 PM',
    noLeidos: 0,
  },
  {
    id: '3',
    emoji: '🔥',
    nombreEvento: 'Rooftop Zacatecas',
    ultimoMensaje: 'Ya llegamos, está increíble',
    hora: 'Ayer',
    noLeidos: 1,
  },
];

export default function ChatsScreen() {
  const [chats] = useState<Chat[]>(CHATS_MOCK);

  const renderChat = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={styles.chatItem}
      activeOpacity={0.7}
      onPress={() => console.log('Abrir chat:', item.id)}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarEmoji}>{item.emoji}</Text>
      </View>

      <View style={styles.chatInfo}>
        <Text style={styles.chatTitle} numberOfLines={1}>
          {item.nombreEvento}
        </Text>
        <Text style={styles.chatMessage} numberOfLines={1}>
          {item.ultimoMensaje}
        </Text>
      </View>

      <View style={styles.chatMeta}>
        <Text style={styles.chatHora}>{item.hora}</Text>
        {item.noLeidos > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.noLeidos}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tus Fiestas 🎉</Text>
      <Text style={styles.subheader}>Eventos a los que asistes</Text>

      {chats.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👀</Text>
          <Text style={styles.emptyText}>Aún no te has unido a ninguna fiesta</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChat}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 70 },
  header: { color: '#fff', fontSize: 28, fontWeight: 'bold', paddingHorizontal: 24 },
  subheader: { color: '#8e8e93', fontSize: 14, paddingHorizontal: 24, marginBottom: 20 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  avatarContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2c2c2e',
    borderWidth: 2,
    borderColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarEmoji: { fontSize: 26 },
  chatInfo: { flex: 1 },
  chatTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  chatMessage: { color: '#8e8e93', fontSize: 14 },
  chatMeta: { alignItems: 'flex-end', marginLeft: 8 },
  chatHora: { color: '#636366', fontSize: 12, marginBottom: 6 },
  badge: {
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#8e8e93', fontSize: 15 },
});