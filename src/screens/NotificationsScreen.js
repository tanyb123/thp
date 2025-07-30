// src/screens/NotificationsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserNotifications,
  markNotificationAsRead,
} from '../api/notificationService';

const NotificationsScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const data = await getUserNotifications(currentUser?.uid);
    setNotifications(data);
    setLoading(false);
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications().then(() => setRefreshing(false));
  }, [loadNotifications]);

  const handleNotificationPress = async (item) => {
    if (!item.read) {
      await markNotificationAsRead(item.id);
      // Update UI instantly
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
    }

    if (item.navLink?.screen) {
      navigation.navigate(item.navLink.screen, item.navLink.params || {});
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unreadItem]}
      onPress={() => handleNotificationPress(item)}
    >
      <Ionicons
        name={
          item.type === 'PROPOSAL_APPROVED'
            ? 'checkmark-circle'
            : 'close-circle'
        }
        size={24}
        color={item.type === 'PROPOSAL_APPROVED' ? '#28a745' : '#dc3545'}
        style={styles.icon}
      />
      <View style={styles.content}>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>
          {item.createdAt
            ? new Date(item.createdAt.seconds * 1000).toLocaleString('vi-VN')
            : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>Bạn không có thông báo nào.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 1,
  },
  unreadItem: {
    backgroundColor: '#eef7ff',
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  icon: {
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#888',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

export default NotificationsScreen;
