//src/screens/ProjectDetailScreen.js
import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ActionSheetIOS,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  updateTaskStatus,
  updateCustomTask,
  deleteProject,
  updateWorkflowStageStatus,
} from '../api/projectService';
import { useAuth } from '../contexts/AuthContext';
import StatusIndicator from '../components/StatusIndicator';
import { useProjectDetails } from '../hooks/useProjectDetails';
import * as Clipboard from 'expo-clipboard';
import ProjectService from '../api/projectService';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Định nghĩa danh sách công việc cố định
const TASK_DEFINITIONS = [
  { key: 'material_separation', label: 'Bóc tách vật tư' },
  { key: 'quotation', label: 'Báo giá' },
  { key: 'material_cutting', label: 'Cắt phôi' },
  { key: 'assembly', label: 'Lắp ráp' },
  { key: 'painting', label: 'Sơn' },
  { key: 'shipping', label: 'Vận chuyển' },
  { key: 'other', label: 'Công việc khác' },
];

// Định nghĩa các trạng thái công việc
const TASK_STATUSES = [
  { value: 'pending', label: 'Chưa thực hiện' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'completed', label: 'Hoàn thành' },
];

const ProjectDetailScreen = ({ route, navigation }) => {
  const { projectId } = route.params;
  const { currentUser } = useAuth();
  const { project, loading, error, fetchProjectData } =
    useProjectDetails(projectId);

  // State cho quản lý công việc
  const [customTaskModalVisible, setCustomTaskModalVisible] = useState(false);
  const [customTaskName, setCustomTaskName] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (project?.tasks?.other?.name) {
      setCustomTaskName(project.tasks.other.name);
    }
  }, [project]);

  // Ẩn header mặc định để tránh trùng lặp nút back / tiêu đề
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Hàm cập nhật trạng thái công việc
  const handleUpdateTaskStatus = async (taskKey) => {
    // Không cho phép thay đổi trạng thái "Báo giá" và "Bóc tách" trực tiếp từ đây
    if (taskKey === 'quotation' || taskKey === 'material_separation') {
      Alert.alert(
        'Thông báo',
        `Để cập nhật trạng thái "${getTaskDisplayName(
          taskKey
        )}", vui lòng vào mục "Quản lý Báo giá".`
      );
      return;
    }

    if (Platform.OS === 'ios') {
      // Sử dụng ActionSheetIOS cho iOS
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...TASK_STATUSES.map((s) => s.label), 'Hủy'],
          cancelButtonIndex: TASK_STATUSES.length,
          title: `Cập nhật "${getTaskDisplayName(taskKey)}"`,
        },
        async (buttonIndex) => {
          if (buttonIndex < TASK_STATUSES.length) {
            try {
              await updateTaskStatus(
                projectId,
                taskKey,
                TASK_STATUSES[buttonIndex].value
              );
              fetchProjectData();
            } catch (err) {
              Alert.alert('Lỗi', err.message);
            }
          }
        }
      );
    } else {
      // Sử dụng Alert cho Android
      Alert.alert(
        'Chọn trạng thái công việc',
        `Cập nhật trạng thái cho "${getTaskDisplayName(taskKey)}"`,
        [
          ...TASK_STATUSES.map((status) => ({
            text: status.label,
            onPress: async () => {
              try {
                await updateTaskStatus(projectId, taskKey, status.value);
                fetchProjectData();
              } catch (err) {
                Alert.alert('Lỗi', err.message);
              }
            },
          })),
          { text: 'Hủy', style: 'cancel' },
        ]
      );
    }
  };

  // Hàm cập nhật tên công việc khác
  const handleUpdateCustomTask = async () => {
    if (!customTaskName.trim() && project?.tasks?.other?.name) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên công việc');
      return;
    }

    try {
      await updateCustomTask(
        projectId,
        customTaskName.trim(),
        currentUser?.uid
      );
      setCustomTaskModalVisible(false);
      fetchProjectData();
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể cập nhật tên công việc khác');
    }
  };

  // Điều hướng đến trang chi tiết khách hàng
  const navigateToCustomerDetail = () => {
    if (project && project.customerId) {
      navigation.navigate('CustomerDetail', { customerId: project.customerId });
    } else {
      Alert.alert('Thông báo', 'Dự án này chưa được gán cho khách hàng nào.');
    }
  };

  // Hàm xoá dự án
  const handleDeleteProject = async () => {
    Alert.alert(
      'Xác nhận Xóa',
      'Bạn có chắc chắn muốn xóa dự án này không? Hành động này không thể hoàn tác.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProject(projectId);
              Alert.alert('Thành công', 'Dự án đã được xóa.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              Alert.alert('Lỗi', err.message);
            }
          },
        },
      ]
    );
  };

  // Xử lý khi chọn khách hàng
  const handleCopyDriveLink = async () => {
    if (project?.driveFolderUrl) {
      try {
        await Clipboard.setStringAsync(project.driveFolderUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        Alert.alert('Lỗi', 'Không thể copy đường dẫn.');
      }
    } else {
      Alert.alert(
        'Thông báo',
        'Không có đường dẫn Drive để copy. Bạn có muốn tạo thư mục Drive cho dự án này không?',
        [
          {
            text: 'Không',
            style: 'cancel',
          },
          {
            text: 'Tạo thư mục',
            onPress: handleCreateDriveFolders,
          },
        ]
      );
    }
  };

  // Hàm tạo thư mục Drive cho dự án
  const handleCreateDriveFolders = async () => {
    try {
      // Kiểm tra đã đăng nhập Google chưa
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        Alert.alert(
          'Cần đăng nhập Google',
          'Bạn cần đăng nhập tài khoản Google để tạo thư mục Drive'
        );
        return;
      }

      // Lấy token
      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) {
        Alert.alert('Lỗi', 'Không thể lấy thông tin xác thực Google');
        return;
      }

      // Hiện thông báo đang tạo
      Alert.alert('Thông báo', 'Đang tạo thư mục Drive, vui lòng đợi...');

      // Gọi Cloud Function
      const result = await ProjectService.createProjectFolders(
        projectId,
        accessToken
      );

      if (result) {
        fetchProjectData(); // Làm mới dữ liệu dự án
        Alert.alert('Thành công', 'Đã tạo thư mục Drive cho dự án thành công');
      }
    } catch (err) {
      console.error('Lỗi tạo thư mục Drive:', err);
      Alert.alert('Lỗi', 'Không thể tạo thư mục Drive: ' + err.message);
    }
  };

  const handleStagePress = (stage) => {
    navigation.navigate('StageDetail', { projectId, stage });
  };

  const changeStatus = async (stage, status) => {
    try {
      await updateWorkflowStageStatus(projectId, stage.stageId, status);
      fetchProjectData();
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    }
  };

  // Hiển thị khi đang tải dữ liệu
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Đang tải thông tin dự án...</Text>
      </View>
    );
  }

  // Hiển thị khi có lỗi
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={50} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Hiển thị khi không tìm thấy dự án
  if (!project) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="briefcase-outline" size={50} color="#999" />
        <Text style={styles.errorText}>Không tìm thấy thông tin dự án</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Định dạng ngày tháng
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Chưa xác định';
    try {
      return new Date(timestamp.seconds * 1000).toLocaleDateString('vi-VN');
    } catch (e) {
      return 'Ngày không hợp lệ';
    }
  };

  // Định dạng số tiền
  const formatCurrency = (amount) => {
    if (!amount) return '0 VNĐ';

    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Lấy màu sắc theo trạng thái dự án
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in-progress':
        return '#FFD54F';
      case 'pending':
        return '#9E9E9E';
      case 'cancelled':
        return '#F44336';
      default:
        return '#6c757d';
    }
  };

  // Lấy nhãn hiển thị cho trạng thái dự án
  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'in-progress':
        return 'Đang thực hiện';
      case 'pending':
        return 'Chờ xử lý';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return 'Không xác định';
    }
  };

  // Lấy màu sắc theo trạng thái công việc
  const getTaskStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      default:
        return '#FF9800';
    }
  };

  // Lấy nhãn hiển thị cho trạng thái công việc
  const getTaskStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'in_progress':
        return 'Đang làm';
      default:
        return 'Chờ xử lý';
    }
  };

  // Lấy tên hiển thị cho công việc
  const getTaskDisplayName = (taskKey) => {
    const task = TASK_DEFINITIONS.find((t) => t.key === taskKey);
    return task ? task.label : 'Công việc không xác định';
  };

  // Render chính
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết dự án</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteProject}
        >
          <Ionicons name="trash-outline" size={24} color="#d11a2a" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Project Header */}
        <View style={styles.projectHeader}>
          <Text style={styles.projectName}>
            {project.name || 'Chưa có tên'}
          </Text>

          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusTag,
                { borderColor: getStatusColor(project.status) },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(project.status) },
                ]}
              >
                {getStatusLabel(project.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.projectDescription}>
            {project.description || 'Không có mô tả'}
          </Text>
        </View>

        {/* Nút điều hướng đến màn hình báo giá */}
        <View style={styles.infoSection}>
          <TouchableOpacity
            style={styles.quotationButton}
            onPress={() =>
              navigation.navigate('Quotation', {
                projectId: project.id,
                projectName: project.name,
                project: project, // Truyền toàn bộ object project
              })
            }
          >
            <Ionicons name="calculator-outline" size={24} color="#fff" />
            <Text style={styles.quotationButtonText}>Quản lý Báo giá</Text>
          </TouchableOpacity>

          {/* Nút quản lý mua vật tư - chỉ hiện khi dự án đang thực hiện */}
          {project.status === 'in-progress' && (
            <TouchableOpacity
              style={[
                styles.quotationButton,
                { backgroundColor: '#4CAF50', marginTop: 8 },
              ]}
              onPress={() =>
                navigation.navigate('MaterialPurchase', {
                  projectId: project.id,
                  projectName: project.name,
                  project: project,
                })
              }
            >
              <Ionicons name="cart-outline" size={24} color="#fff" />
              <Text style={styles.quotationButtonText}>Quản lý Mua Vật Tư</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.quotationButton,
              { backgroundColor: '#FF9800', marginTop: 8 },
            ]}
            onPress={() =>
              navigation.navigate('CreateDeliveryNote', {
                projectId: project.id,
                materials: project.materials, // Pass materials if available
              })
            }
          >
            <Ionicons name="document-text-outline" size={24} color="#fff" />
            <Text style={styles.quotationButtonText}>
              Tạo Biên Bản Giao Hàng
            </Text>
          </TouchableOpacity>

          {/* Nút mở thư mục dự án trên Google Drive */}
          {project.driveFolderUrl ? (
            <View style={styles.driveLinkContainer}>
              <TouchableOpacity
                style={styles.driveLinkButton}
                onPress={() => {
                  const { Linking } = require('react-native');
                  Linking.openURL(project.driveFolderUrl).catch(() =>
                    Alert.alert('Lỗi', 'Không thể mở thư mục Google Drive')
                  );
                }}
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
                  { backgroundColor: copySuccess ? '#4CAF50' : '#2980B9' },
                ]}
                onPress={handleCopyDriveLink}
              >
                <Ionicons
                  name={copySuccess ? 'checkmark' : 'copy'}
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.driveNotAvailable}>
              Thư mục Google Drive đang được tạo...
            </Text>
          )}
        </View>

        {/* Phần thông tin khách hàng và các thông tin khác */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>

          <TouchableOpacity
            style={styles.customerCard}
            onPress={navigateToCustomerDetail}
          >
            <View style={styles.customerInfo}>
              <Ionicons
                name="business"
                size={24}
                color="#0066cc"
                style={styles.customerIcon}
              />
              <View>
                <Text style={styles.customerName}>
                  {project.customerName || 'Không xác định'}
                </Text>
                {project.customerContact && (
                  <Text style={styles.customerDetail}>
                    Người liên hệ: {project.customerContact}
                  </Text>
                )}
                {project.customerEmail && (
                  <Text style={styles.customerDetail}>
                    Email: {project.customerEmail}
                  </Text>
                )}
                {project.customerPhone && (
                  <Text style={styles.customerDetail}>
                    SĐT: {project.customerPhone}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày bắt đầu:</Text>
            <Text style={styles.infoValue}>
              {project.startDate
                ? formatDate(project.startDate)
                : 'Chưa xác định'}
            </Text>
          </View>

          {/* Hiển thị đường dẫn Drive */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Google Drive:</Text>
            {project.driveFolderUrl ? (
              <TouchableOpacity
                style={styles.driveLink}
                onPress={handleCopyDriveLink}
              >
                <Ionicons name="link" size={16} color="#0066cc" />
                <Text style={styles.driveLinkText}>
                  {copySuccess ? 'Đã copy đường dẫn!' : 'Copy đường dẫn'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.createFolderButton}
                onPress={handleCreateDriveFolders}
              >
                <Ionicons name="cloud-upload" size={16} color="#0066cc" />
                <Text style={styles.createFolderText}>Tạo thư mục Drive</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày kết thúc:</Text>
            <Text style={styles.infoValue}>
              {project.endDate ? formatDate(project.endDate) : 'Chưa xác định'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Số ngày thi công:</Text>
            <Text style={styles.infoValue}>
              {project.durationInDays
                ? `${project.durationInDays} ngày`
                : 'Chưa xác định'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vị trí thi công:</Text>
            <Text style={styles.infoValue}>
              {project.location === 'workshop'
                ? 'Tại xưởng'
                : project.location === 'site'
                ? 'Tại công trình'
                : 'Chưa xác định'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngân sách:</Text>
            <Text style={styles.infoValue}>
              {project.budget
                ? formatCurrency(project.budget)
                : 'Chưa xác định'}
            </Text>
          </View>

          {project.notes && (
            <>
              <Text style={styles.notesLabel}>Ghi chú:</Text>
              <Text style={styles.notesText}>{project.notes}</Text>
            </>
          )}
        </View>

        {/* Quy trình Sản xuất */}
        <View style={styles.tasksBoard}>
          <Text style={styles.sectionTitle}>Quy trình Sản xuất</Text>
          {project.workflowStages?.length ? (
            project.workflowStages
              .sort((a, b) => a.order - b.order)
              .map((item) => {
                const color =
                  item.status === 'completed'
                    ? '#4CAF50'
                    : item.status === 'in_progress'
                    ? '#FFD54F'
                    : '#9E9E9E';
                return (
                  <TouchableOpacity
                    key={item.stageId}
                    style={styles.taskRow}
                    onPress={() => handleStagePress(item)}
                  >
                    <Text style={styles.taskName}>{item.processName}</Text>
                    <Text
                      style={[
                        styles.taskStatusText,
                        { backgroundColor: color + '33', color: color },
                      ]}
                    >
                      {item.status === 'completed'
                        ? 'Hoàn thành'
                        : item.status === 'in_progress'
                        ? 'Đang làm'
                        : 'Chờ xử lý'}
                    </Text>
                  </TouchableOpacity>
                );
              })
          ) : (
            <Text style={styles.emptyTasksText}>Chưa có công đoạn.</Text>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProject', { project })}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.editButtonText}>Chỉnh sửa</Text>
        </TouchableOpacity>
      </View>

      {/* Modal cập nhật tên công việc khác */}
      <Modal
        visible={customTaskModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomTaskModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setCustomTaskModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cập nhật công việc khác</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setCustomTaskModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Tên công việc:</Text>
              <TextInput
                style={styles.input}
                value={customTaskName}
                onChangeText={setCustomTaskName}
                placeholder="Nhập tên công việc khác..."
              />

              <TouchableOpacity
                style={[styles.saveTaskButton, { marginTop: 20 }]}
                onPress={handleUpdateCustomTask}
              >
                <Text style={styles.saveTaskButtonText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  deleteButton: {
    padding: 4,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  projectHeader: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  projectName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statusTag: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  projectDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginTop: 8,
  },
  infoSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerIcon: {
    marginRight: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  customerDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  notesLabel: {
    fontSize: 15,
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  footer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  editButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tasksBoard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 12,
  },
  taskName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  taskNamePlaceholder: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  taskStatusText: {
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 80,
    textAlign: 'center',
  },
  editTaskButton: {
    padding: 8,
  },
  emptyTasksContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTasksText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    width: '100%',
    backgroundColor: '#fff',
    fontSize: 16,
  },
  saveTaskButton: {
    backgroundColor: '#0066cc',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveTaskButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quotationButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  quotationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  driveLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  driveLinkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 10,
  },
  driveLinkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    marginLeft: 12,
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driveNotAvailable: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  driveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  createFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  createFolderText: {
    marginLeft: 8,
    color: '#0066cc',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ProjectDetailScreen;
