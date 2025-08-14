import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  Share,
} from 'react-native';
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useTheme } from '../contexts/ThemeContext';
import { updateTaskStatus, assignTaskToUser } from '../api/projectService'; // Added assignTaskToUser import
import { Ionicons } from '@expo/vector-icons';
import {
  getTaskDisplayLabel,
  getStatusDisplayLabel,
  getStatusColor,
} from '../utils/taskHelpers';
import TaskAssignmentModal from '../components/TaskAssignmentModal'; // Import the modal component
import MediaInstructionsViewer from '../components/MediaInstructionsViewer';

const TaskDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { projectId, taskKey } = route.params;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isAssignmentModalVisible, setIsAssignmentModalVisible] =
    useState(false); // New state for modal visibility

  const fetchProjectDetails = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  // Refresh project data when screen comes into focus to ensure media instructions are up to date
  useFocusEffect(
    useCallback(() => {
      fetchProjectDetails();
    }, [fetchProjectDetails])
  );

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

  const handleOpenDriveFolder = () => {
    if (project?.driveFolderUrl) {
      Linking.openURL(project.driveFolderUrl);
    } else {
      Alert.alert('Thông báo', 'Không tìm thấy thư mục Drive cho dự án này.');
    }
  };

  const handleShareDriveLink = async () => {
    if (project?.driveFolderUrl) {
      try {
        await Share.share({
          message: project.driveFolderUrl,
        });
        setShareSuccess(true);

        // Reset success message after 2 seconds
        setTimeout(() => {
          setShareSuccess(false);
        }, 2000);
      } catch (error) {
        console.error('Error sharing link:', error);
        Alert.alert('Lỗi', 'Không thể chia sẻ đường dẫn.');
      }
    } else {
      Alert.alert('Thông báo', 'Không có đường dẫn Drive để chia sẻ.');
    }
  };

  // New function to handle task assignment
  const handleAssignTask = (userId, userName) => {
    setIsUpdating(true);
    assignTaskToUser(projectId, taskKey, userId, userName)
      .then(() => {
        // Update the local project state to reflect the change
        setProject((prevProject) => {
          if (!prevProject || !prevProject.tasks) return prevProject;

          const updatedTasks = { ...prevProject.tasks };
          updatedTasks[taskKey] = {
            ...updatedTasks[taskKey],
            assignedTo: userId,
            assignedToName: userName,
          };

          return {
            ...prevProject,
            tasks: updatedTasks,
          };
        });

        Alert.alert('Thành công', 'Đã phân công công việc cho ' + userName);
      })
      .catch((error) => {
        console.error('Error assigning task:', error);
        Alert.alert('Lỗi', 'Không thể phân công công việc: ' + error.message);
      })
      .finally(() => {
        setIsAssignmentModalVisible(false);
        setIsUpdating(false);
      });
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

  // Find the related workflow stage for this task
  const relatedStage = project?.workflowStages?.find(
    (stage) =>
      stage.stageId === task?.stageId ||
      stage.processKey === taskKey ||
      stage.processName?.toLowerCase().includes(taskKey.replace('_', ' '))
  );

  // Extract media instructions from the related stage
  const hasMediaInstructions =
    relatedStage &&
    (relatedStage.instructionNotes ||
      (relatedStage.instructionImages &&
        relatedStage.instructionImages.length > 0) ||
      relatedStage.instructionAudio);

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

          {/* Display assigned user if available */}
          {task?.assignedTo && (
            <View style={styles.assignedContainer}>
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Đã giao cho:{' '}
              </Text>
              <View style={styles.assignedUser}>
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarText}>
                    {(task.assignedToName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.assignedUserName, { color: theme.text }]}>
                  {task.assignedToName || 'Người dùng không xác định'}
                </Text>
              </View>
            </View>
          )}

          {/* Add assign task button */}
          <TouchableOpacity
            style={[styles.assignButton, { backgroundColor: theme.primary }]}
            onPress={() => setIsAssignmentModalVisible(true)}
          >
            <Ionicons
              name="person-add"
              size={18}
              color="#fff"
              style={styles.buttonIcon}
            />
            <Text style={styles.assignButtonText}>
              {task?.assignedTo ? 'Thay đổi người thực hiện' : 'Giao công việc'}
            </Text>
          </TouchableOpacity>
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

          {project?.driveFolderUrl && (
            <View style={styles.driveLinkContainer}>
              <TouchableOpacity
                style={[
                  styles.driveLinkButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleOpenDriveFolder}
              >
                <Ionicons
                  name="folder-open"
                  size={18}
                  color="#fff"
                  style={styles.buttonIcon}
                />
                <Text style={styles.driveLinkText}>Mở thư mục Drive</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shareButton,
                  {
                    backgroundColor: shareSuccess
                      ? theme.success
                      : theme.secondary,
                  },
                ]}
                onPress={handleShareDriveLink}
                accessibilityLabel="Chia sẻ đường dẫn thư mục"
              >
                <Ionicons
                  name={shareSuccess ? 'checkmark' : 'share'}
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Media Instructions Section */}
        {hasMediaInstructions && (
          <MediaInstructionsViewer
            instructionImages={relatedStage.instructionImages || []}
            instructionNotes={relatedStage.instructionNotes || ''}
            instructionAudio={relatedStage.instructionAudio || null}
            visible={true}
          />
        )}
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

      {/* Task Assignment Modal */}
      <TaskAssignmentModal
        visible={isAssignmentModalVisible}
        onClose={() => setIsAssignmentModalVisible(false)}
        onAssign={handleAssignTask}
        taskName={taskLabel}
        currentAssignee={task?.assignedTo}
      />
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: { fontSize: 16, fontWeight: 'bold' },
  detailText: { fontSize: 16, lineHeight: 24 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#333' },
  completeButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  driveLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  driveLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  driveLinkText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  shareButton: {
    marginLeft: 12,
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // New styles for assigned user
  assignedContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  assignedUser: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(0, 102, 204, 0.05)',
    padding: 12,
    borderRadius: 8,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  assignedUserName: {
    fontSize: 16,
    fontWeight: '500',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  assignButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default TaskDetailScreen;
