import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const WorkerCard = ({ worker, onPress, theme }) => {
  const [currentTime, setCurrentTime] = useState('');

  // Update timer every second for working workers
  useEffect(() => {
    let interval = null;

    if (worker.status === 'working' && worker.currentTask) {
      interval = setInterval(() => {
        const startTime = new Date(worker.currentTask.startTime.seconds * 1000);
        const now = new Date();
        const diffMs = now.getTime() - startTime.getTime();

        // Calculate hours and minutes
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        setCurrentTime(
          `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [worker.status, worker.currentTask]);

  // Get card width based on screen size - optimized for tablet landscape
  const getCardWidth = () => {
    const screenWidth = width;
    const padding = 32; // Total horizontal padding
    const spacing = 16; // Space between cards

    if (screenWidth > 1200) {
      // 5 columns for large tablets
      return (screenWidth - padding - spacing * 4) / 5;
    } else if (screenWidth > 900) {
      // 4 columns for medium tablets
      return (screenWidth - padding - spacing * 3) / 4;
    } else if (screenWidth > 600) {
      // 3 columns for small tablets
      return (screenWidth - padding - spacing * 2) / 3;
    } else {
      // 2 columns for phones
      return (screenWidth - padding - spacing) / 2;
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (worker.status) {
      case 'working':
        return '#4CAF50'; // Green
      case 'idle':
        return '#9E9E9E'; // Gray
      default:
        return '#9E9E9E';
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (worker.status) {
      case 'working':
        return 'Đang làm việc';
      case 'idle':
        return 'Đang rảnh';
      default:
        return 'Không xác định';
    }
  };

  // Format worker role - simplified for kiosk
  const formatRole = (role) => {
    const roleMap = {
      tho_han: 'Thợ Hàn',
      tho_co_khi: 'Thợ Cơ Khí',
      tho_lap_rap: 'Thợ Lắp Ráp',
    };
    return roleMap[role] || role;
  };

  const cardWidth = getCardWidth();
  const statusColor = getStatusColor();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          width: cardWidth,
        },
      ]}
      onPress={() => onPress(worker)}
      activeOpacity={0.7}
    >
      {/* Avatar with Status Ring */}
      <View style={styles.avatarContainer}>
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: statusColor,
              borderWidth: worker.status === 'working' ? 4 : 2,
            },
          ]}
        >
          {worker.avatar ? (
            <Image source={{ uri: worker.avatar }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              <Ionicons name="person" size={36} color={theme.primary} />
            </View>
          )}
        </View>

        {/* Notification Badge */}
        {worker.newTasksCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.badgeText}>
              {worker.newTasksCount > 9 ? '9+' : worker.newTasksCount}
            </Text>
          </View>
        )}
      </View>

      {/* Worker Info */}
      <View style={styles.infoContainer}>
        <Text
          style={[styles.workerName, { color: theme.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {worker.workerName}
        </Text>

        {/* Current Task */}
        {worker.status === 'working' && worker.currentTask && (
          <View style={styles.taskContainer}>
            <Text
              style={[styles.taskName, { color: theme.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {worker.currentTask.stageName}
            </Text>
            <Text
              style={[styles.projectName, { color: theme.textSecondary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {worker.currentTask.projectName}
            </Text>

            {/* Timer */}
            <View style={styles.timerContainer}>
              <Ionicons name="time" size={12} color={theme.primary} />
              <Text style={[styles.timerText, { color: theme.primary }]}>
                {currentTime || worker.currentTask.duration}
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    margin: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    minHeight: 200,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  avatarRing: {
    borderRadius: 39,
    padding: 3,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoContainer: {
    alignItems: 'center',
    flex: 1,
  },
  workerName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },

  taskContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  taskName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  projectName: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 4,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timerText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 2,
  },
});

export default WorkerCard;
