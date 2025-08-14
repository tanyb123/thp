import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getProjects } from '../api/projectService';
import { getUsers } from '../api/userService';
import { assignWorkerToStage } from '../api/projectService';
import MediaInstructionsViewer from '../components/MediaInstructionsViewer';
import StageAssignmentModal from '../components/StageAssignmentModal';

const WorkAllocationScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  // State management
  const [projects, setProjects] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStage, setSelectedStage] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, workersData] = await Promise.all([
        getProjects(),
        getUsers(),
      ]);

      setProjects(projectsData);
      setWorkers(workersData.filter((user) => user.role === 'worker'));
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Lỗi', 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleStagePress = (project, stage) => {
    setSelectedStage({
      ...stage,
      projectId: project.id,
      projectName: project.name,
    });
    setShowAssignmentModal(true);
  };

  const handleViewInstructions = (project, stage) => {
    setSelectedStage({
      ...stage,
      projectId: project.id,
      projectName: project.name,
    });
    setShowInstructionsModal(true);
  };

  const handleAssignWorker = async (workerId, workerName) => {
    try {
      if (!selectedStage) return;

      await assignWorkerToStage(
        selectedStage.projectId,
        selectedStage.stageId,
        workerId,
        workerName
      );

      Alert.alert('Thành công', `Đã giao việc cho ${workerName}`);
      setShowAssignmentModal(false);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Error assigning worker:', error);
      Alert.alert('Lỗi', 'Không thể giao việc');
    }
  };

  const renderStageItem = (project, stage) => {
    const hasInstructions =
      stage.instructionNotes ||
      (stage.instructionImages && stage.instructionImages.length > 0) ||
      stage.instructionAudio;

    const isAssigned =
      stage.assignedWorkers && stage.assignedWorkers.length > 0;
    const statusColor = isAssigned ? '#28a745' : '#ffc107';
    const statusText = isAssigned ? 'Đã giao' : 'Chưa giao';

    return (
      <View key={stage.stageId} style={styles.stageItem}>
        <View style={styles.stageHeader}>
          <View style={styles.stageInfo}>
            <Text style={styles.stageName}>{stage.processName}</Text>
            <Text style={styles.projectName}>{project.name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>

        {isAssigned && (
          <View style={styles.assignedWorkers}>
            <Text style={styles.assignedLabel}>Người thực hiện:</Text>
            {stage.assignedWorkerNames?.map((name, index) => (
              <Text key={index} style={styles.workerName}>
                • {name}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.stageActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleStagePress(project, stage)}
          >
            <Ionicons name="person-add" size={16} color="#0066cc" />
            <Text style={styles.actionBtnText}>Giao việc</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              hasInstructions && styles.hasInstructionsBtn,
            ]}
            onPress={() => handleViewInstructions(project, stage)}
          >
            <Ionicons
              name={hasInstructions ? 'document-text' : 'document-text-outline'}
              size={16}
              color={hasInstructions ? '#28a745' : '#666'}
            />
            <Text
              style={[
                styles.actionBtnText,
                hasInstructions && styles.hasInstructionsText,
              ]}
            >
              {hasInstructions ? 'Xem hướng dẫn' : 'Chưa có hướng dẫn'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              navigation.navigate('StageDetail', {
                projectId: project.id,
                stage: stage,
              })
            }
          >
            <Ionicons name="create" size={16} color="#ff6b35" />
            <Text style={styles.actionBtnText}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderProjectItem = ({ item: project }) => {
    const stages = project.workflowStages || [];

    return (
      <View style={styles.projectCard}>
        <View style={styles.projectHeader}>
          <Text style={styles.projectTitle}>{project.name}</Text>
          <Text style={styles.customerName}>{project.customerName}</Text>
        </View>

        {stages.map((stage) => renderStageItem(project, stage))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Giao việc & Hướng dẫn
        </Text>
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

      {/* Projects List */}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={renderProjectItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Assignment Modal */}
      <StageAssignmentModal
        visible={showAssignmentModal}
        stage={selectedStage}
        workers={workers}
        onClose={() => setShowAssignmentModal(false)}
        onAssign={handleAssignWorker}
      />

      {/* Instructions Modal */}
      <Modal
        visible={showInstructionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInstructionsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Hướng dẫn: {selectedStage?.processName}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowInstructionsModal(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedStage && (
              <MediaInstructionsViewer
                instructionImages={selectedStage.instructionImages}
                instructionNotes={selectedStage.instructionNotes}
                instructionAudio={selectedStage.instructionAudio}
                visible={true}
              />
            )}
          </ScrollView>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
  },
  listContainer: {
    padding: 16,
  },
  projectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  projectHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#666',
  },
  stageItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageInfo: {
    flex: 1,
  },
  stageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  projectName: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  assignedWorkers: {
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  assignedLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  workerName: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  stageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flex: 1,
    marginHorizontal: 2,
  },
  hasInstructionsBtn: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff9',
  },
  actionBtnText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    textAlign: 'center',
    flex: 1,
  },
  hasInstructionsText: {
    color: '#28a745',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
});

export default WorkAllocationScreen;
