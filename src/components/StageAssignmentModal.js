import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  getDocs,
  getFirestore,
} from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';

const StageAssignmentModal = ({
  visible,
  onClose,
  onAssign,
  projectId,
  selectedStage,
  projectStages,
  navigation,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [filteredWorkers, setFilteredWorkers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);

  // Update selectedStageId when selectedStage prop changes
  useEffect(() => {
    if (selectedStage) {
      setSelectedStageId(selectedStage.stageId);
    } else {
      setSelectedStageId(null);
    }
  }, [selectedStage]);

  useEffect(() => {
    if (visible) {
      console.log('Modal opened, loading workers...');
      console.log('Project stages:', projectStages);
      loadWorkers();
    }
  }, [visible, projectStages]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredWorkers(workers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = workers.filter(
        (worker) =>
          (worker.displayName &&
            worker.displayName.toLowerCase().includes(query)) ||
          (worker.email && worker.email.toLowerCase().includes(query))
      );
      setFilteredWorkers(filtered);
    }
  }, [searchQuery, workers]);

  const loadWorkers = async () => {
    try {
      setLoading(true);
      const db = getFirestore();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', 'in', ['ky_su', 'cong_nhan']));

      const querySnapshot = await getDocs(q);
      const workersList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log('Loaded workers:', workersList.length);
      setWorkers(workersList);
      setFilteredWorkers(workersList);
    } catch (error) {
      console.error('Error loading workers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStage = (stageId) => {
    setSelectedStageId(stageId);
  };

  const handleSelectWorker = (workerId) => {
    setSelectedWorkerId(workerId);
  };

  const handleAssign = () => {
    if (selectedStageId && selectedWorkerId) {
      const selectedWorker = workers.find((w) => w.id === selectedWorkerId);
      const selectedStage = projectStages.find(
        (s) => s.stageId === selectedStageId
      );

      if (selectedWorker && selectedStage) {
        onAssign(
          selectedStageId,
          selectedWorkerId,
          selectedWorker.displayName || selectedWorker.email
        );
      }
    }
  };

  const handleViewStageDetails = () => {
    if (selectedStageId) {
      const selectedStage = projectStages.find(
        (s) => s.stageId === selectedStageId
      );
      if (selectedStage) {
        onClose();
        navigation.navigate('StageDetail', { projectId, stage: selectedStage });
      }
    }
  };

  const renderStageItem = ({ item }) => {
    console.log('Rendering stage item:', item);
    const isSelected = selectedStageId === item.stageId;
    const statusColor =
      item.status === 'completed'
        ? '#4CAF50'
        : item.status === 'in_progress'
        ? '#FFD54F'
        : '#9E9E9E';

    return (
      <TouchableOpacity
        style={[styles.stageItem, isSelected && styles.selectedStageItem]}
        onPress={() => handleSelectStage(item.stageId)}
      >
        <View style={styles.stageInfo}>
          <Text style={styles.stageName}>{item.processName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {item.status === 'completed'
                ? 'Hoàn thành'
                : item.status === 'in_progress'
                ? 'Đang làm'
                : 'Chờ xử lý'}
            </Text>
          </View>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
        )}
      </TouchableOpacity>
    );
  };

  const renderWorkerItem = ({ item }) => {
    console.log('Rendering worker item:', item);
    const isSelected = selectedWorkerId === item.id;
    const displayName =
      item.displayName || item.email || 'Người dùng không xác định';
    const role = item.role === 'ky_su' ? 'Kỹ sư' : 'Công nhân';

    return (
      <TouchableOpacity
        style={[styles.workerItem, isSelected && styles.selectedWorkerItem]}
        onPress={() => handleSelectWorker(item.id)}
      >
        <View style={styles.workerAvatar}>
          <Text style={styles.workerInitial}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.workerInfo}>
          <Text style={styles.workerName}>{displayName}</Text>
          <Text style={styles.workerRole}>{role}</Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
        )}
      </TouchableOpacity>
    );
  };

  console.log('Rendering modal with:', {
    visible,
    projectStages: projectStages?.length || 0,
    workers: workers?.length || 0,
    filteredWorkers: filteredWorkers?.length || 0,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Phân công công việc</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionsContainer}>
            {/* Stages Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chọn Công đoạn:</Text>
              <FlatList
                data={projectStages || []}
                keyExtractor={(item) => item.stageId || item.id}
                renderItem={renderStageItem}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 8 }}
                showsVerticalScrollIndicator={true}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyMessage}>
                      Không có công đoạn nào
                    </Text>
                  </View>
                }
              />

              {selectedStageId && (
                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={handleViewStageDetails}
                >
                  <Ionicons name="eye-outline" size={18} color="#fff" />
                  <Text style={styles.viewDetailsText}>
                    Xem chi tiết công đoạn
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Workers Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chọn Người thực hiện:</Text>
              <View style={styles.searchContainer}>
                <Ionicons
                  name="search"
                  size={20}
                  color="#666"
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm kiếm người thực hiện..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                />
              </View>

              {loading ? (
                <ActivityIndicator
                  size="large"
                  color="#0066cc"
                  style={styles.loader}
                />
              ) : (
                <FlatList
                  data={filteredWorkers || []}
                  keyExtractor={(item) => item.id}
                  renderItem={renderWorkerItem}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 8 }}
                  showsVerticalScrollIndicator={true}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyMessage}>
                        {searchQuery
                          ? 'Không tìm thấy người phù hợp'
                          : 'Không có người thực hiện nào'}
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.assignButton,
                (!selectedStageId || !selectedWorkerId) &&
                  styles.disabledButton,
              ]}
              onPress={handleAssign}
              disabled={!selectedStageId || !selectedWorkerId}
            >
              <Text style={styles.assignButtonText}>Phân công</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '95%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  sectionsContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  section: {
    flex: 1,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedStageItem: {
    backgroundColor: 'rgba(0, 102, 204, 0.05)',
  },
  stageInfo: {
    flex: 1,
  },
  stageName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    marginBottom: 16,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },

  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedWorkerItem: {
    backgroundColor: 'rgba(0, 102, 204, 0.05)',
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workerInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  workerRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066cc',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    flexShrink: 0,
  },
  viewDetailsText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    flexShrink: 0,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f1f1f1',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  assignButton: {
    backgroundColor: '#0066cc',
  },
  assignButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  loader: {
    marginVertical: 32,
  },
  emptyMessage: {
    padding: 16,
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 80,
  },
});

export default StageAssignmentModal;
