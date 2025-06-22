import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useTheme } from '../contexts/ThemeContext';
import { updateTaskStatus } from '../api/projectService'; // We will create this function
import { Ionicons } from '@expo/vector-icons';
import {
  getTaskDisplayLabel,
  getStatusDisplayLabel,
  getStatusColor,
} from '../utils/taskHelpers';

const TaskDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { projectId, taskKey } = route.params;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      try {
        setLoading(true);
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
          setProject({ id: projectSnap.id, ...projectSnap.data() });
        } else {
          setError('Không tìm thấy thông tin dự án.');
        }
      } catch (err) {
        console.error('Error fetching project details for task:', err);
        setError('Lỗi khi tải dữ liệu dự án.');
      } finally {
        setLoading(false);
      }
    };
    fetchProjectDetails();
  }, [projectId]);

  const handleCompleteTask = async () => {
    setIsUpdating(true);
    try {
      await updateTaskStatus(projectId, taskKey, 'completed');
      Alert.alert('Thành công', 'Đã cập nhật trạng thái công việc.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Error updating task status:', err);
      Alert.alert(
        'Lỗi',
        err.message || 'Không thể cập nhật trạng thái công việc.'
      );
    } finally {
      setIsUpdating(false);
    }
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

  const task = project?.tasks?.[taskKey];
  const taskLabel = getTaskDisplayLabel(taskKey, task);
  const statusLabel = getStatusDisplayLabel(task?.status);
  const statusColor = getStatusColor(task?.status, theme);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Chi tiết Công việc
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Công việc
          </Text>
          <Text style={[styles.taskName, { color: theme.text }]}>
            {taskLabel}
          </Text>
          <View style={styles.statusContainer}>
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              Trạng thái:{' '}
            </Text>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Thuộc dự án
          </Text>
          <Text style={[styles.detailText, { color: theme.text }]}>
            Tên dự án: {project?.name}
          </Text>
          <Text style={[styles.detailText, { color: theme.text }]}>
            Khách hàng: {project?.customerName || 'Không có'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            {
              backgroundColor:
                task?.status === 'completed' || isUpdating
                  ? theme.textMuted
                  : theme.success || '#28a745',
            },
          ]}
          onPress={handleCompleteTask}
          disabled={task?.status === 'completed' || isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {task?.status === 'completed'
                ? 'Đã hoàn thành'
                : 'Hoàn thành công việc'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', marginLeft: 16 },
  content: { flex: 1, padding: 16 },
  card: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#888',
  },
  taskName: { fontSize: 26, fontWeight: 'bold', marginBottom: 10 },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 16, fontWeight: 'bold' },
  detailText: { fontSize: 16, lineHeight: 24 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#333' },
  completeButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default TaskDetailScreen;
