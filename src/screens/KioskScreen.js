import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import ProductionService from '../api/productionService';
import { updateWorkflowStageStatus } from '../api/projectService';
import WorkerCard from '../components/WorkerCard';
import WorkDetailModal from '../components/WorkDetailModal';

const { width, height } = Dimensions.get('window');

const KioskScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  // State management
  const [factoryStatus, setFactoryStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkModal, setShowWorkModal] = useState(false);
  const [completedTasks, setCompletedTasks] = useState(new Set()); // 🆕 Track completed tasks
  const [screenDimensions, setScreenDimensions] = useState({ width, height });

  // Handle screen orientation changes
  useEffect(() => {
    const updateDimensions = () => {
      const { width: newWidth, height: newHeight } = Dimensions.get('window');
      setScreenDimensions({ width: newWidth, height: newHeight });
    };

    Dimensions.addEventListener('change', updateDimensions);
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Real-time subscription
  useEffect(() => {
    let unsubscribe = null;

    const setupRealtimeUpdates = async () => {
      try {
        // Initial load
        await loadFactoryStatus();

        // Setup real-time subscription
        unsubscribe = ProductionService.subscribeLiveFactoryStatus((status) => {
          console.log(
            'Real-time factory status update:',
            status.length,
            'workers'
          );
          setFactoryStatus(status);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error setting up real-time updates:', error);
        setLoading(false);
      }
    };

    setupRealtimeUpdates();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Load factory status
  const loadFactoryStatus = async () => {
    try {
      const status = await ProductionService.getLiveFactoryStatus();
      setFactoryStatus(status);
    } catch (error) {
      console.error('Error loading factory status:', error);
      Alert.alert('Lỗi', 'Không thể tải trạng thái xưởng');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFactoryStatus();
    setRefreshing(false);
  };

  // Handle worker card press
  const handleWorkerPress = async (worker) => {
    try {
      setSelectedWorker(worker);
      setShowWorkModal(true);
    } catch (error) {
      console.error('Error selecting worker:', error);
      Alert.alert('Lỗi', 'Không thể mở chi tiết công nhân');
    }
  };

  // Handle start work session
  const handleStartWork = async (workerId, workerName, task) => {
    try {
      const sessionId = await ProductionService.startWorkSession(
        workerId,
        workerName,
        task.projectId,
        task.projectName,
        task.stageId,
        task.stageName
      );

      console.log('Started work session:', sessionId);
      setShowWorkModal(false);

      // Update task status to 'in_progress'
      await updateWorkflowStageStatus(
        task.projectId,
        task.stageId,
        'in_progress',
        workerId
      );

      Alert.alert('Bắt đầu', `${workerName} đã bắt đầu: ${task.stageName}`, [
        { text: 'OK' },
      ]);
    } catch (error) {
      console.error('Error starting work session:', error);
      Alert.alert('Lỗi', 'Không thể bắt đầu công việc');
    }
  };

  // Handle stop work session
  const handleStopWork = async (workerId, workerName) => {
    try {
      const runningSession = await ProductionService.getRunningSessionForWorker(
        workerId
      );

      if (!runningSession) {
        Alert.alert('Lỗi', 'Không có phiên làm việc nào đang chạy');
        return;
      }

      const duration = await ProductionService.stopWorkSession(
        runningSession.id
      );

      // Update task status to 'completed'
      await updateWorkflowStageStatus(
        runningSession.projectId,
        runningSession.stageId,
        'completed',
        workerId
      );

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
      Alert.alert('Lỗi', 'Không thể kết thúc công việc');
    }
  };

  // Handle task completion
  const handleTaskCompleted = (taskId) => {
    setCompletedTasks((prev) => new Set([...prev, taskId]));
  };

  // Format duration for display
  const formatDuration = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h} giờ ${m} phút`;
  };

  // Calculate grid columns based on screen dimensions - optimized for tablet landscape
  const getNumColumns = () => {
    const { width: currentWidth, height: currentHeight } = screenDimensions;
    const isLandscape = currentWidth > currentHeight;

    if (isLandscape) {
      // Landscape mode - optimize for more columns
      if (currentWidth > 1400) return 7; // Large tablets/desktop
      if (currentWidth > 1200) return 6; // Medium-large tablets
      if (currentWidth > 900) return 5; // Medium tablets
      if (currentWidth > 700) return 4; // Small tablets
      return 3; // Large phones in landscape
    } else {
      // Portrait mode
      if (currentWidth > 1200) return 4; // Large tablets
      if (currentWidth > 900) return 3; // Medium tablets
      if (currentWidth > 600) return 2; // Small tablets
      return 2; // Phones
    }
  };

  // Render worker card
  const renderWorkerCard = ({ item }) => (
    <WorkerCard
      worker={item}
      onPress={() => handleWorkerPress(item)}
      theme={theme}
    />
  );

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

  const statusSummary = getStatusSummary();
  const numColumns = getNumColumns();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Kiosk Xưởng Sản Xuất
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: theme.primary }]}
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
      </View>

      {/* Status Summary */}
      <View
        style={[styles.statusBar, { backgroundColor: theme.cardBackground }]}
      >
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={[styles.statusText, { color: theme.text }]}>
            Đang làm: {statusSummary.working}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#9E9E9E' }]} />
          <Text style={[styles.statusText, { color: theme.text }]}>
            Rảnh: {statusSummary.idle}
          </Text>
        </View>

        <View style={styles.statusItem}>
          <Ionicons name="notifications" size={16} color={theme.primary} />
          <Text style={[styles.statusText, { color: theme.text }]}>
            Việc mới: {statusSummary.totalTasks}
          </Text>
        </View>

        {/* Show grid info in landscape */}
        {screenDimensions.width > screenDimensions.height && (
          <View style={styles.statusItem}>
            <Ionicons name="grid" size={16} color={theme.primary} />
            <Text style={[styles.statusText, { color: theme.text }]}>
              Layout: {numColumns} cột
            </Text>
          </View>
        )}
      </View>

      {/* Worker Grid */}
      <FlatList
        data={factoryStatus}
        renderItem={renderWorkerCard}
        keyExtractor={(item) => item.workerId}
        numColumns={numColumns}
        key={`${numColumns}-${screenDimensions.width}-${screenDimensions.height}`} // Force re-render when dimensions change
        contentContainerStyle={[
          styles.gridContainer,
          { paddingHorizontal: screenDimensions.width > 900 ? 24 : 16 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
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
        }
      />

      {/* Work Detail Modal */}
      <WorkDetailModal
        visible={showWorkModal}
        worker={selectedWorker}
        onClose={() => setShowWorkModal(false)}
        onStartWork={handleStartWork}
        onStopWork={handleStopWork}
        onTaskCompleted={handleTaskCompleted} // 🆕 Pass callback
        theme={theme}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    flexWrap: 'wrap',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  gridContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});

export default KioskScreen;
