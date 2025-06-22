//src/screens/TaskReportScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const TaskCard = ({ item, onPress, theme }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return { bg: 'rgba(46, 204, 113, 0.2)', text: '#27AE60' };
      case 'in_progress':
        return { bg: 'rgba(52, 152, 219, 0.2)', text: '#2980B9' };
      case 'pending':
        return { bg: 'rgba(241, 196, 15, 0.2)', text: '#F39C12' };
      default:
        return { bg: theme.border, text: theme.textSecondary };
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'pending':
        return 'Chờ xử lý';
      default:
        return 'Không xác định';
    }
  };

  const statusStyle = getStatusColor(item.status);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.taskLabel, { color: theme.text }]}>
          {item.taskLabel}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.projectName, { color: theme.textSecondary }]}>
          Dự án: {item.projectName}
        </Text>
        <Text style={[styles.assignedTo, { color: theme.textSecondary }]}>
          Phụ trách: {item.assignedToName}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const TaskReportScreen = ({ navigation }) => {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const isManager = ['giam_doc', 'pho_giam_doc', 'admin'].includes(
    currentUser?.role
  );

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      let tasksQuery;
      const tasksCollection = collection(db, 'tasks');

      if (isManager) {
        // Managers see all tasks
        tasksQuery = query(tasksCollection, orderBy('updatedAt', 'desc'));
      } else {
        // Regular users see only their assigned tasks
        tasksQuery = query(
          tasksCollection,
          where('assignedToId', '==', currentUser.uid),
          orderBy('updatedAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(tasksQuery);
      const fetchedTasks = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(fetchedTasks);
      setFilteredTasks(fetchedTasks);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Không thể tải danh sách công việc.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [currentUser])
  );

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredTasks(tasks);
    } else {
      const filtered = tasks.filter((task) => task.status === activeFilter);
      setFilteredTasks(filtered);
    }
  }, [activeFilter, tasks]);

  const handleTaskPress = (item) => {
    navigation.navigate('ProjectDetail', { projectId: item.projectId });
  };

  const renderFilterButtons = () => {
    const filters = [
      { key: 'all', label: 'Tất cả' },
      { key: 'in_progress', label: 'Đang làm' },
      { key: 'completed', label: 'Hoàn thành' },
      { key: 'pending', label: 'Chờ xử lý' },
    ];

    return (
      <View style={styles.filterContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              {
                backgroundColor:
                  activeFilter === filter.key ? theme.primary : theme.card,
              },
            ]}
            onPress={() => setActiveFilter(filter.key)}
          >
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === filter.key ? '#fff' : theme.text },
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: theme.background }]}
      >
        <Text style={{ color: theme.text }}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Text style={[styles.headerTitle, { color: theme.text }]}>
        {isManager ? 'Báo cáo Công việc' : 'Công việc của bạn'}
      </Text>
      {isManager && renderFilterButtons()}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskCard
            item={item}
            onPress={() => handleTaskPress(item)}
            theme={theme}
          />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => (
          <View style={styles.centerContainer}>
            <Text style={{ color: theme.textSecondary }}>
              Không có công việc nào.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', padding: 16 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskLabel: { fontSize: 18, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardBody: {},
  projectName: { fontSize: 14, marginBottom: 4 },
  assignedTo: { fontSize: 14 },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  filterText: {
    fontWeight: '500',
  },
});

export default TaskReportScreen;
