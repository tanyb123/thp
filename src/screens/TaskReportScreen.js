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
  ScrollView,
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
        <Text
          style={[styles.taskLabel, { color: theme.text }]}
          numberOfLines={1}
        >
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

  // Common states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States for Manager View
  const [myTasks, setMyTasks] = useState([]);
  const [staffPendingTasks, setStaffPendingTasks] = useState([]);
  const [staffCompletedTasks, setStaffCompletedTasks] = useState([]);

  // State for manager tabs
  const [activeManagerView, setActiveManagerView] = useState('my_tasks'); // 'my_tasks', 'staff_pending', 'staff_completed'

  // States for Staff View
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');

  const isManager = ['giam_doc', 'pho_giam_doc', 'admin'].includes(
    currentUser?.role
  );

  const fetchManagerTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const tasksCollection = collection(db, 'tasks');

      // 1. My tasks (pending or in-progress)
      const myTasksQuery = query(
        tasksCollection,
        where('assignedToId', '==', currentUser.uid),
        where('status', 'in', ['pending', 'in_progress'])
      );
      const myTasksSnapshot = await getDocs(myTasksQuery);
      setMyTasks(
        myTasksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      // 2. Staff pending tasks
      const staffPendingQuery = query(
        tasksCollection,
        where('assignedToId', '!=', currentUser.uid),
        where('status', 'in', ['pending', 'in_progress'])
      );
      const staffPendingSnapshot = await getDocs(staffPendingQuery);
      setStaffPendingTasks(
        staffPendingSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );

      // 3. Staff completed tasks
      const staffCompletedQuery = query(
        tasksCollection,
        where('assignedToId', '!=', currentUser.uid),
        where('status', '==', 'completed')
      );
      const staffCompletedSnapshot = await getDocs(staffCompletedQuery);
      setStaffCompletedTasks(
        staffCompletedSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    } catch (err) {
      console.error('Error fetching manager tasks:', err);
      setError('Không thể tải báo cáo công việc.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const tasksCollection = collection(db, 'tasks');
      const tasksQuery = query(
        tasksCollection,
        where('assignedToId', '==', currentUser.uid),
        orderBy('updatedAt', 'desc')
      );

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
      if (isManager) {
        fetchManagerTasks();
      } else {
        fetchStaffTasks();
      }
    }, [currentUser, isManager])
  );

  useEffect(() => {
    if (!isManager) {
      if (activeFilter === 'all') {
        setFilteredTasks(tasks);
      } else {
        const filtered = tasks.filter((task) => task.status === activeFilter);
        setFilteredTasks(filtered);
      }
    }
  }, [activeFilter, tasks, isManager]);

  const handleTaskPress = (item) => {
    if (isManager) {
      // Managers go to the full project detail screen
      navigation.navigate('ProjectDetail', { projectId: item.projectId });
    } else {
      // Staff go to the dedicated, simplified task detail screen
      navigation.navigate('TaskDetail', {
        projectId: item.projectId,
        taskKey: item.taskKey,
      });
    }
  };

  // -- RENDER METHODS --

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

  const renderTaskList = (data) => {
    if (data.length === 0) {
      return (
        <View style={styles.emptySection}>
          <Text style={{ color: theme.textSecondary }}>
            Không có công việc nào.
          </Text>
        </View>
      );
    }
    return data.map((item) => (
      <TaskCard
        key={item.id}
        item={item}
        onPress={() => handleTaskPress(item)}
        theme={theme}
      />
    ));
  };

  // Manager View
  if (isManager) {
    const renderManagerContent = () => {
      switch (activeManagerView) {
        case 'staff_pending':
          return renderTaskList(staffPendingTasks);
        case 'staff_completed':
          return renderTaskList(staffCompletedTasks);
        case 'my_tasks':
        default:
          return renderTaskList(myTasks);
      }
    };

    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Báo cáo Công việc
        </Text>

        {/* Manager Tabs */}
        <View style={styles.managerTabContainer}>
          <TouchableOpacity
            style={[
              styles.managerTab,
              { backgroundColor: theme.card },
              activeManagerView === 'my_tasks' && {
                backgroundColor: theme.primary,
              },
            ]}
            onPress={() => setActiveManagerView('my_tasks')}
          >
            <Text
              style={[
                styles.managerTabText,
                { color: theme.text },
                activeManagerView === 'my_tasks' && { color: '#FFFFFF' },
              ]}
            >
              Việc của tôi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.managerTab,
              { backgroundColor: theme.card },
              activeManagerView === 'staff_pending' && {
                backgroundColor: theme.primary,
              },
            ]}
            onPress={() => setActiveManagerView('staff_pending')}
          >
            <Text
              style={[
                styles.managerTabText,
                { color: theme.text },
                activeManagerView === 'staff_pending' && { color: '#FFFFFF' },
              ]}
            >
              NV Đang Làm
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.managerTab,
              { backgroundColor: theme.card },
              activeManagerView === 'staff_completed' && {
                backgroundColor: theme.primary,
              },
            ]}
            onPress={() => setActiveManagerView('staff_completed')}
          >
            <Text
              style={[
                styles.managerTabText,
                { color: theme.text },
                activeManagerView === 'staff_completed' && { color: '#FFFFFF' },
              ]}
            >
              Đã Hoàn Thành
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.listContainer}>
          {renderManagerContent()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Staff View
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Text style={[styles.headerTitle, { color: theme.text }]}>
        Công việc của bạn
      </Text>
      {renderFilterButtons()}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    paddingBottom: 8,
  },
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
  taskLabel: { fontSize: 18, fontWeight: 'bold', flexShrink: 1 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8,
  },
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
  // Styles for Manager View
  managerTabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  managerTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  managerTabText: {
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySection: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
});

export default TaskReportScreen;
