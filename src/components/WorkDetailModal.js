import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProductionService from '../api/productionService';
import MediaInstructionsViewer from './MediaInstructionsViewer';

const { width, height } = Dimensions.get('window');

const WorkDetailModal = ({
  visible,
  worker,
  onClose,
  onStartWork,
  onStopWork,
  onTaskCompleted,
  theme,
}) => {
  const [tasks, setTasks] = useState([]);
  const [runningSession, setRunningSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [selectedTaskForInstructions, setSelectedTaskForInstructions] =
    useState(null);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(0); // Thời gian đã tạm ngưng (milliseconds)
  const [pauseStartTime, setPauseStartTime] = useState(null); // Thời điểm bắt đầu pause

  // Load worker tasks when modal opens
  useEffect(() => {
    if (visible && worker) {
      // 🚀 Reset states when modal opens fresh
      console.log('Modal opened for worker:', worker.workerName);
      loadWorkerTasks();
      loadRunningSession();
    } else if (!visible) {
      // 🧹 Clean up when modal closes
      console.log('Modal closed, cleaning up states');
      setTasks([]);
      setRunningSession(null);
      setCurrentTime('');
    }
  }, [visible, worker]);

  // Update timer for running session
  useEffect(() => {
    let interval = null;

    if (runningSession && runningSession.startTime && !isPaused) {
      interval = setInterval(() => {
        const startTime = new Date(runningSession.startTime.seconds * 1000);
        const now = new Date();
        const diffMs = now.getTime() - startTime.getTime() - pausedTime;

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
  }, [runningSession, isPaused, pausedTime, pauseStartTime]);

  // Load worker tasks
  const loadWorkerTasks = async () => {
    if (!worker) return;

    try {
      setLoading(true);
      const workerTasks = await ProductionService.getTasksForWorker(
        worker.workerId
      );
      setTasks(workerTasks);
    } catch (error) {
      console.error('Error loading worker tasks:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách công việc');
    } finally {
      setLoading(false);
    }
  };

  // Load running session
  const loadRunningSession = async () => {
    if (!worker) return;

    try {
      const session = await ProductionService.getRunningSessionForWorker(
        worker.workerId
      );
      setRunningSession(session);
    } catch (error) {
      console.error('Error loading running session:', error);
    }
  };

  // Handle viewing instructions
  const handleViewInstructions = (task) => {
    setSelectedTaskForInstructions(task);
    setShowInstructionsModal(true);
  };

  const handleCloseInstructions = () => {
    setShowInstructionsModal(false);
    setSelectedTaskForInstructions(null);
  };

  // Handle start work
  const handleStartWork = async (task) => {
    if (!worker) return;

    Alert.alert('Xác nhận', `Bắt đầu công việc: ${task.stageName}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bắt đầu',
        onPress: async () => {
          await onStartWork(worker.workerId, worker.workerName, task);
          // Reload data after starting
          await loadRunningSession();
          await loadWorkerTasks();
        },
      },
    ]);
  };

  // Handle stop work
  const handleStopWork = async () => {
    if (!worker || !runningSession) return;

    console.log('=== HANDLE STOP WORK DEBUG ===');
    console.log('Worker:', worker.workerId);
    console.log('Running session:', {
      id: runningSession.id,
      stageName: runningSession.stageName,
      projectId: runningSession.projectId,
      stageId: runningSession.stageId,
    });

    Alert.alert(
      'Xác nhận',
      `Kết thúc công việc: ${runningSession.stageName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Kết thúc',
          style: 'destructive',
          onPress: async () => {
            console.log('User confirmed stop work');

            // 🚀 OPTIMISTIC UI UPDATE - Cập nhật giao diện ngay lập tức
            console.log('Applying optimistic updates...');

            // 1. Dừng timer ngay lập tức bằng cách clear running session
            setRunningSession(null);

            // 2. Loại bỏ task vừa hoàn thành khỏi danh sách ngay lập tức
            const completedTaskId = runningSession.stageId;
            console.log('🎯 Completing task with stageId:', completedTaskId);
            console.log(
              '📋 Current tasks before filter:',
              tasks.map((t) => ({
                stageId: t.stageId,
                stageName: t.stageName,
                stageStatus: t.stageStatus,
              }))
            );

            setTasks((prevTasks) => {
              const filteredTasks = prevTasks.filter(
                (task) => task.stageId !== completedTaskId
              );
              console.log(
                '📋 Tasks after filter:',
                filteredTasks.map((t) => ({
                  stageId: t.stageId,
                  stageName: t.stageName,
                  stageStatus: t.stageStatus,
                }))
              );
              return filteredTasks;
            });

            // 3. 📡 Thông báo cho parent component về task đã hoàn thành
            if (onTaskCompleted) {
              onTaskCompleted(completedTaskId, worker.workerId);
            }

            console.log('Optimistic updates applied - UI updated immediately');

            // 4. Gửi yêu cầu lên server để đồng bộ dữ liệu (chạy background)
            try {
              console.log('🔄 Starting server sync...', {
                workerId: worker.workerId,
                workerName: worker.workerName,
                runningSession: {
                  id: runningSession.id,
                  projectId: runningSession.projectId,
                  stageId: runningSession.stageId,
                  stageName: runningSession.stageName,
                },
              });

              await onStopWork(
                worker.workerId,
                worker.workerName,
                runningSession
              );
              console.log('✅ Server sync completed successfully');
            } catch (error) {
              console.error('❌ Server sync failed:', error);

              // 🔄 ROLLBACK - Nếu server fail, khôi phục lại UI
              console.log(
                '🔄 Rolling back optimistic updates due to server error'
              );
              await loadRunningSession();
              await loadWorkerTasks();

              Alert.alert(
                'Lỗi',
                'Không thể hoàn thành công việc. Vui lòng thử lại.'
              );
            }
          },
        },
      ]
    );
  };

  // Handle pause work
  const handlePauseWork = () => {
    if (!runningSession) return;

    Alert.alert(
      'Xác nhận',
      `Tạm ngưng công việc: ${runningSession.stageName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Tạm ngưng',
          onPress: () => {
            const now = new Date().getTime();
            setPauseStartTime(now);
            setIsPaused(true);
          },
        },
      ]
    );
  };

  // Handle resume work
  const handleResumeWork = () => {
    if (!runningSession) return;

    Alert.alert(
      'Xác nhận',
      `Tiếp tục công việc: ${runningSession.stageName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Tiếp tục',
          onPress: () => {
            if (pauseStartTime) {
              const now = new Date().getTime();
              const pauseDuration = now - pauseStartTime;
              setPausedTime((prev) => prev + pauseDuration);
            }
            setPauseStartTime(null);
            setIsPaused(false);
          },
        },
      ]
    );
  };

  // Format role
  const formatRole = (role) => {
    const roleMap = {
      tho_han: 'Thợ Hàn',
      tho_co_khi: 'Thợ Cơ Khí',
      tho_lap_rap: 'Thợ Lắp Ráp',
    };
    return roleMap[role] || role;
  };

  // Get task status color
  const getTaskStatusColor = (status) => {
    switch (status) {
      case 'assigned':
        return '#2196F3'; // Blue
      case 'in_progress':
        return '#FF9800'; // Orange
      case 'completed':
        return '#4CAF50'; // Green
      default:
        return '#9E9E9E'; // Gray
    }
  };

  // Get task status text
  const getTaskStatusText = (status) => {
    switch (status) {
      case 'assigned':
        return 'Được giao';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'completed':
        return 'Hoàn thành';
      default:
        return 'Không xác định';
    }
  };

  if (!worker) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.cardBackground,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Chi tiết công việc
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Worker Info */}
          <View
            style={[
              styles.workerInfo,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <View style={styles.workerHeader}>
              {worker.avatar ? (
                <Image
                  source={{ uri: worker.avatar }}
                  style={styles.workerAvatar}
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: theme.primaryLight },
                  ]}
                >
                  <Ionicons name="person" size={32} color={theme.primary} />
                </View>
              )}

              <View style={styles.workerDetails}>
                <Text style={[styles.workerName, { color: theme.text }]}>
                  {worker.workerName}
                </Text>
                <Text
                  style={[styles.workerRole, { color: theme.textSecondary }]}
                >
                  {formatRole(worker.workerRole)}
                </Text>

                <View style={styles.statusContainer}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          worker.status === 'working' ? '#4CAF50' : '#9E9E9E',
                      },
                    ]}
                  />
                  <Text
                    style={[styles.statusText, { color: theme.textSecondary }]}
                  >
                    {worker.status === 'working'
                      ? 'Đang làm việc'
                      : 'Đang rảnh'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Running Session */}
          {runningSession && (
            <View
              style={[
                styles.section,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="play-circle" size={20} color="#4CAF50" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Công việc đang thực hiện
                </Text>
              </View>

              <View
                style={[
                  styles.runningTask,
                  { backgroundColor: 'rgba(76, 175, 80, 0.1)' },
                ]}
              >
                <View style={styles.taskHeader}>
                  <Text style={[styles.taskName, { color: theme.text }]}>
                    {runningSession.stageName}
                  </Text>
                  <Text
                    style={[styles.projectName, { color: theme.textSecondary }]}
                  >
                    {runningSession.projectName}
                  </Text>
                </View>

                <View style={styles.timerContainer}>
                  <Ionicons name="time" size={16} color="#4CAF50" />
                  <Text style={[styles.timerText, { color: '#4CAF50' }]}>
                    {currentTime}
                  </Text>
                </View>

                <View style={styles.actionButtonsContainer}>
                  {/* Pause/Resume Button */}
                  <TouchableOpacity
                    style={[
                      styles.pauseButton,
                      { backgroundColor: isPaused ? '#4CAF50' : '#FF9800' },
                    ]}
                    onPress={isPaused ? handleResumeWork : handlePauseWork}
                  >
                    <Ionicons
                      name={isPaused ? 'play' : 'pause'}
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.pauseButtonText}>
                      {isPaused ? 'TIẾP TỤC' : 'TẠM NGƯNG'}
                    </Text>
                  </TouchableOpacity>

                  {/* Complete Button */}
                  <TouchableOpacity
                    style={[styles.stopButton, { backgroundColor: '#F44336' }]}
                    onPress={handleStopWork}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.stopButtonText}>HOÀN THÀNH</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Available Tasks */}
          <View
            style={[styles.section, { backgroundColor: theme.cardBackground }]}
          >
            {(() => {
              const availableTasks = tasks.filter(
                (task) => task.stageStatus !== 'completed'
              );

              // Debug logs
              console.log('=== TASK FILTERING DEBUG ===');
              console.log('Total tasks:', tasks.length);
              console.log(
                'Available tasks (not completed):',
                availableTasks.length
              );
              console.log(
                'Running session:',
                runningSession ? runningSession.stageName : 'None'
              );
              tasks.forEach((task, index) => {
                console.log(`Task ${index + 1}:`, {
                  stageName: task.stageName,
                  stageStatus: task.stageStatus,
                  projectId: task.projectId,
                  stageId: task.stageId,
                });
              });
              console.log('=== END DEBUG ===');

              return (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="list" size={20} color={theme.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Công việc được giao ({availableTasks.length})
                    </Text>
                  </View>

                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <Text
                        style={[
                          styles.loadingText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Đang tải...
                      </Text>
                    </View>
                  ) : availableTasks.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons
                        name="checkmark-circle"
                        size={48}
                        color="#4CAF50"
                      />
                      <Text
                        style={[
                          styles.emptyText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {tasks.length === 0
                          ? 'Không có công việc mới'
                          : 'Tất cả công việc đã hoàn thành'}
                      </Text>
                    </View>
                  ) : (
                    availableTasks.map((task, index) => (
                      <View
                        key={`${task.projectId}-${task.stageId}`}
                        style={styles.taskItem}
                      >
                        <View style={styles.taskInfo}>
                          <Text
                            style={[styles.taskName, { color: theme.text }]}
                          >
                            {task.stageName}
                          </Text>
                          <Text
                            style={[
                              styles.projectName,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {task.projectName}
                          </Text>

                          <View style={styles.taskStatus}>
                            <View
                              style={[
                                styles.statusDot,
                                {
                                  backgroundColor: getTaskStatusColor(
                                    task.stageStatus
                                  ),
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.statusText,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {getTaskStatusText(task.stageStatus)}
                            </Text>
                          </View>

                          {/* Media Instructions Indicators */}
                          {(task.hasInstructions ||
                            task.hasImages ||
                            task.hasAudio) && (
                            <View style={styles.mediaIndicators}>
                              <Text
                                style={[
                                  styles.mediaLabel,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Hướng dẫn:
                              </Text>
                              {task.hasInstructions && (
                                <Ionicons
                                  name="document-text"
                                  size={14}
                                  color="#0066cc"
                                  style={styles.mediaIcon}
                                />
                              )}
                              {task.hasImages && (
                                <Ionicons
                                  name="image"
                                  size={14}
                                  color="#0066cc"
                                  style={styles.mediaIcon}
                                />
                              )}
                              {task.hasAudio && (
                                <Ionicons
                                  name="volume-high"
                                  size={14}
                                  color="#0066cc"
                                  style={styles.mediaIcon}
                                />
                              )}
                            </View>
                          )}
                        </View>

                        <View style={styles.taskActions}>
                          {/* View Instructions Button - Always show for debugging */}
                          <TouchableOpacity
                            style={[
                              styles.instructionsButton,
                              { backgroundColor: '#0066cc' },
                            ]}
                            onPress={() => handleViewInstructions(task)}
                          >
                            <Ionicons
                              name="information-circle"
                              size={14}
                              color="#fff"
                            />
                            <Text style={styles.instructionsButtonText}>
                              HƯỚNG DẪN
                            </Text>
                          </TouchableOpacity>

                          {/* Start Work Button */}
                          {task.stageStatus === 'assigned' &&
                            !runningSession && (
                              <TouchableOpacity
                                style={[
                                  styles.startButton,
                                  { backgroundColor: '#4CAF50' },
                                ]}
                                onPress={() => handleStartWork(task)}
                              >
                                <Ionicons name="play" size={16} color="#fff" />
                                <Text style={styles.startButtonText}>
                                  BẮT ĐẦU
                                </Text>
                              </TouchableOpacity>
                            )}
                        </View>
                      </View>
                    ))
                  )}
                </>
              );
            })()}
          </View>
        </ScrollView>
      </View>

      {/* Instructions Modal */}
      <Modal
        visible={showInstructionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseInstructions}
      >
        <View
          style={[
            styles.instructionsModalContainer,
            { backgroundColor: theme.background },
          ]}
        >
          <View
            style={[
              styles.instructionsHeader,
              { borderBottomColor: theme.border },
            ]}
          >
            <Text style={[styles.instructionsTitle, { color: theme.text }]}>
              Hướng dẫn: {selectedTaskForInstructions?.stageName}
            </Text>
            <TouchableOpacity
              style={styles.closeInstructionsButton}
              onPress={handleCloseInstructions}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {selectedTaskForInstructions && (
            <ScrollView style={{ flex: 1 }}>
              <MediaInstructionsViewer
                instructionImages={
                  selectedTaskForInstructions.instructionImages || []
                }
                instructionNotes={
                  selectedTaskForInstructions.instructionNotes || ''
                }
                instructionAudio={
                  selectedTaskForInstructions.instructionAudio || null
                }
                visible={true}
              />

              {/* Debug info */}
              <View
                style={{
                  padding: 16,
                  backgroundColor: '#f0f0f0',
                  margin: 16,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>
                  Debug Info:
                </Text>
                <Text>Task: {selectedTaskForInstructions.stageName}</Text>
                <Text>Project: {selectedTaskForInstructions.projectName}</Text>
                <Text>
                  Has Instructions:{' '}
                  {selectedTaskForInstructions.hasInstructions ? 'Yes' : 'No'}
                </Text>
                <Text>
                  Has Images:{' '}
                  {selectedTaskForInstructions.hasImages ? 'Yes' : 'No'}
                </Text>
                <Text>
                  Has Audio:{' '}
                  {selectedTaskForInstructions.hasAudio ? 'Yes' : 'No'}
                </Text>
                <Text>
                  Images Count:{' '}
                  {selectedTaskForInstructions.instructionImages?.length || 0}
                </Text>
                <Text>
                  Notes Length:{' '}
                  {selectedTaskForInstructions.instructionNotes?.length || 0}
                </Text>
                <Text>
                  Audio:{' '}
                  {selectedTaskForInstructions.instructionAudio
                    ? 'Available'
                    : 'None'}
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeButton: {
    marginRight: 16,
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  workerInfo: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  workerDetails: {
    flex: 1,
  },
  workerName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  workerRole: {
    fontSize: 14,
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  runningTask: {
    borderRadius: 8,
    padding: 16,
  },
  taskHeader: {
    marginBottom: 8,
  },
  taskName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  projectName: {
    fontSize: 14,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  pauseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  taskInfo: {
    flex: 1,
  },
  taskStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  taskActions: {
    flexDirection: 'row',
    gap: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  instructionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  instructionsButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  mediaIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  mediaLabel: {
    fontSize: 11,
    marginRight: 6,
    fontWeight: '500',
  },
  mediaIcon: {
    marginRight: 4,
  },
  instructionsModalContainer: {
    flex: 1,
  },
  instructionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  closeInstructionsButton: {
    padding: 8,
  },
});

export default WorkDetailModal;
