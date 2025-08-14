//src/screens/ProductionDashboard.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ProductionService from '../api/productionService';
import { updateWorkflowStageStatus } from '../api/projectService';
import WorkerCard from '../components/WorkerCard';
import WorkDetailModal from '../components/WorkDetailModal';

const { width } = Dimensions.get('window');

const ProductionDashboard = ({ navigation }) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  // State management
  const [factoryStatus, setFactoryStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkModal, setShowWorkModal] = useState(false);
  const [completedTasks, setCompletedTasks] = useState(new Set()); // 🆕 Track completed tasks

  useEffect(() => {
    loadDashboardData();

    // Setup real-time subscription
    const unsubscribe = ProductionService.subscribeLiveFactoryStatus(
      (status) => {
        console.log(
          'Production Dashboard - Real-time update:',
          status.length,
          'workers'
        );
        setFactoryStatus(status);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Factory status will be loaded via real-time subscription
      // No need to load projects data for this dashboard
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Lỗi', 'Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleWorkerPress = (worker) => {
    setSelectedWorker(worker);
    setShowWorkModal(true);
  };

  const handleStartWork = async (workerId, workerName, task) => {
    try {
      const sessionId = await ProductionService.startWorkSession(
        workerId,
        task.projectId,
        task.stageId,
        task.stageName,
        task.projectName
      );

      console.log('Started work session:', sessionId);

      // Close modal and show success
      setShowWorkModal(false);
      Alert.alert('Thành công', `${workerName} đã bắt đầu: ${task.stageName}`, [
        { text: 'OK' },
      ]);
    } catch (error) {
      console.error('Error starting work session:', error);
      Alert.alert('Lỗi', `Không thể bắt đầu công việc: ${error.message}`);
    }
  };

  // Handle task completion (optimistic update callback)
  const handleTaskCompleted = (completedTaskId, workerId) => {
    console.log(
      '🚀 Task completed optimistically:',
      completedTaskId,
      'for worker:',
      workerId
    );

    // Add to completed tasks set
    setCompletedTasks((prev) => new Set([...prev, completedTaskId]));

    // Update factory status to reflect completed task
    setFactoryStatus((prevStatus) =>
      prevStatus.map((worker) => {
        if (worker.workerId === workerId) {
          return {
            ...worker,
            // Remove completed task from worker's task count
            taskCount: Math.max(0, (worker.taskCount || 0) - 1),
            // Clear running session if this was the running task
            runningSession:
              worker.runningSession?.stageId === completedTaskId
                ? null
                : worker.runningSession,
          };
        }
        return worker;
      })
    );
  };

  const handleStopWork = async (workerId, workerName, runningSession) => {
    try {
      // Stop the work session
      const duration = await ProductionService.stopWorkSession(
        runningSession.id
      );

      console.log(
        'Stopped work session:',
        runningSession.id,
        'Duration:',
        duration
      );

      // Update workflow stage status to completed
      if (runningSession.projectId && runningSession.stageId) {
        await updateWorkflowStageStatus(
          runningSession.projectId,
          runningSession.stageId,
          'completed'
        );
        console.log(
          'Updated workflow stage status to completed:',
          runningSession.stageId
        );
      }

      // Close modal and show success
      setShowWorkModal(false);
      Alert.alert(
        'Hoàn thành',
        `${workerName} đã hoàn thành: ${
          runningSession.stageName
        }\nThời gian: ${formatDuration(duration)}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error stopping work session:', error);
      Alert.alert('Lỗi', `Không thể kết thúc công việc: ${error.message}`);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate grid columns based on screen width
  const getNumColumns = () => {
    if (width > 1200) return 6; // Large tablets/desktop
    if (width > 900) return 4; // Medium tablets
    if (width > 600) return 3; // Small tablets
    return 2; // Phones
  };

  // Get status summary
  const getStatusSummary = () => {
    const working = factoryStatus.filter((w) => w.status === 'working').length;
    const idle = factoryStatus.filter((w) => w.status === 'idle').length;
    const totalTasks = factoryStatus.reduce(
      (sum, w) => sum + w.newTasksCount,
      0
    );

    return { working, idle, totalTasks };
  };

  const { working, idle, totalTasks } = getStatusSummary();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Dashboard Sản Xuất</Text>
          <Text style={styles.headerSubtitle}>Giám sát thời gian thực</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Ionicons
            name="refresh"
            size={20}
            color="#fff"
            style={refreshing ? { opacity: 0.5 } : {}}
          />
        </TouchableOpacity>
      </View>

      {/* Status Summary */}
      <View
        style={[styles.statusBar, { backgroundColor: theme.cardBackground }]}
      >
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>
            Đang làm việc
          </Text>
          <Text style={[styles.statusValue, { color: theme.text }]}>
            {working}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#9E9E9E' }]} />
          <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>
            Đang rảnh
          </Text>
          <Text style={[styles.statusValue, { color: theme.text }]}>
            {idle}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Ionicons name="notifications" size={16} color={theme.primary} />
          <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>
            Công việc mới
          </Text>
          <Text style={[styles.statusValue, { color: theme.text }]}>
            {totalTasks}
          </Text>
        </View>
      </View>

      {/* Workers Grid */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.workersGrid}>
          {factoryStatus.map((worker) => (
            <WorkerCard
              key={worker.workerId}
              worker={worker}
              onPress={() => handleWorkerPress(worker)}
              screenWidth={width}
              numColumns={getNumColumns()}
            />
          ))}
        </View>

        {factoryStatus.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="people-outline"
              size={64}
              color={theme.textSecondary}
            />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {loading ? 'Đang tải...' : 'Không có công nhân nào'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Work Detail Modal */}
      <WorkDetailModal
        visible={showWorkModal}
        worker={selectedWorker}
        onClose={() => {
          setShowWorkModal(false);
          setSelectedWorker(null);
        }}
        onStartWork={handleStartWork}
        onStopWork={handleStopWork}
        onTaskCompleted={handleTaskCompleted} // 🆕 Pass callback
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  workersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});

export default ProductionDashboard;
