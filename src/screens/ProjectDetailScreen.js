//src/screens/ProjectDetailScreen.js
import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  Linking,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Google Signin imported once at top
import { httpsCallable, getFunctions } from 'firebase/functions';
import app, { db } from '../config/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import {
  updateTaskStatus,
  updateCustomTask,
  deleteProject,
  updateWorkflowStageStatus,
  assignWorkerToStage,
} from '../api/projectService';
import { useAuth } from '../contexts/AuthContext';
import StatusIndicator from '../components/StatusIndicator';
import { useProjectDetails } from '../hooks/useProjectDetails';
import { useAIChatIntegration } from '../hooks/useAIChatIntegration';
import * as Clipboard from 'expo-clipboard';
import ProjectService from '../api/projectService';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { updateProject } from '../api/projectService';
import { serverTimestamp } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';
import StageAssignmentModal from '../components/StageAssignmentModal';
import { getDiscussionCount } from '../api/projectDiscussionService';
import ProjectDocumentsTab from '../components/ProjectDocumentsTab';

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
  const { theme } = useTheme();
  const { openAIChatWithProject } = useAIChatIntegration();

  // State cho quản lý công việc
  const [customTaskModalVisible, setCustomTaskModalVisible] = useState(false);
  const [customTaskName, setCustomTaskName] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [stageAssignmentModalVisible, setStageAssignmentModalVisible] =
    useState(false);
  const [selectedStageForAssignment, setSelectedStageForAssignment] =
    useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [discussionCount, setDiscussionCount] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (project?.tasks?.other?.name) {
      setCustomTaskName(project.tasks.other.name);
    }
  }, [project]);

  // Load discussion count
  const loadDiscussionCount = async () => {
    if (projectId) {
      try {
        const count = await getDiscussionCount(projectId);
        setDiscussionCount(count);
      } catch (error) {
        console.error('Error loading discussion count:', error);
      }
    }
  };

  useEffect(() => {
    loadDiscussionCount();
  }, [projectId]);

  // Reload discussion count when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadDiscussionCount();
    }, [projectId])
  );

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
    console.log('🎯 Stage pressed:', {
      stageId: stage.stageId,
      processName: stage.processName,
      status: stage.status,
      projectId,
    });

    try {
      navigation.navigate('StageDetail', { projectId, stage });
    } catch (error) {
      console.error('❌ Navigation error:', error);
      Alert.alert('Lỗi', `Không thể mở chi tiết công đoạn: ${error.message}`);
    }
  };

  const changeStatus = async (stage, status) => {
    try {
      await updateWorkflowStageStatus(projectId, stage.stageId, status);
      fetchProjectData();
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    }
  };

  // Handle stage assignment
  const handleStageAssignment = async (stageId, workerId, workerName) => {
    try {
      setIsAssigning(true);
      await assignWorkerToStage(projectId, stageId, workerId, workerName);
      setStageAssignmentModalVisible(false);
      Alert.alert('Thành công', `Đã phân công ${workerName} vào công đoạn này`);
      fetchProjectData(); // Refresh project data
    } catch (error) {
      console.error('Error assigning worker to stage:', error);
      Alert.alert('Lỗi', `Không thể phân công công việc: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle assign workers button press
  const handleAssignWorkers = (stage) => {
    console.log('Opening assignment modal for stage:', stage);
    console.log('Project workflowStages:', project?.workflowStages);
    console.log('All project data:', project);
    setSelectedStageForAssignment(stage);
    setStageAssignmentModalVisible(true);
  };

  // Single-flight guard for generating contract
  const isGeneratingContractRef = useRef(false);

  // Helper: safely get Google access token avoiding concurrent getTokens calls
  const getAccessTokenSafe = async () => {
    // Ensure signed in first
    const signedIn = await GoogleSignin.isSignedIn();
    if (!signedIn) {
      await GoogleSignin.signIn();
    }

    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { accessToken } = await GoogleSignin.getTokens();
        if (accessToken) return accessToken;
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message || '');
        if (msg.includes('previous promise did not settle')) {
          // Small backoff before retrying
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error('Không lấy được Google access token');
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
    if (!amount) return '0 đ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Lấy màu sắc theo trạng thái dự án
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FFA000'; // Orange
      case 'in_progress':
      case 'in-progress':
        return '#1E88E5'; // Blue
      case 'production_complete':
        return '#8E24AA'; // Purple
      case 'delivered':
        return '#43A047'; // Green
      case 'completed':
        return '#009688'; // Teal
      case 'cancelled':
        return '#E53935'; // Red
      default:
        return '#9E9E9E'; // Grey
    }
  };

  // Lấy nhãn hiển thị cho trạng thái dự án
  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Chờ xử lý';
      case 'in_progress':
      case 'in-progress':
        return 'Đang thực hiện';
      case 'production_complete':
        return 'Sản xuất hoàn tất';
      case 'delivered':
        return 'Đã giao hàng';
      case 'completed':
        return 'Hoàn thành';
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
        {currentUser?.role === 'giam_doc' ||
        currentUser?.role === 'pho_giam_doc' ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteProject}
          >
            <Ionicons name="trash-outline" size={24} color="#d11a2a" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('overview')}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: activeTab === 'overview' ? '#2E7D32' : '#fff',
              borderWidth: 1,
              borderColor: '#eef1f5',
            }}
          >
            <Text style={{ color: activeTab === 'overview' ? '#fff' : '#111' }}>
              Tổng quan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('documents')}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: activeTab === 'documents' ? '#2E7D32' : '#fff',
              borderWidth: 1,
              borderColor: '#eef1f5',
            }}
          >
            <Text
              style={{ color: activeTab === 'documents' ? '#fff' : '#111' }}
            >
              Tài liệu
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'documents' && (
          <View style={{ padding: 12 }}>
            <ProjectDocumentsTab
              projectId={projectId}
              onOpenDrive={(item) => {}}
            />
          </View>
        )}
        {/* Project Header */}
        <View style={styles.projectHeader}>
          <View style={styles.projectHeaderTop}>
            <Text style={styles.projectName}>
              {project.name || 'Chưa có tên'}
            </Text>
            <View
              style={[
                styles.statusChip,
                { backgroundColor: `${getStatusColor(project.status)}20` },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: getStatusColor(project.status) },
                ]}
              >
                {getStatusLabel(project.status)}
              </Text>
            </View>
          </View>

          {project.description ? (
            <Text style={styles.projectDescription}>{project.description}</Text>
          ) : null}
        </View>

        {/* Action Buttons Section - Grid tiles */}
        <View style={styles.actionsContainer}>
          <View style={styles.tileGrid}>
            <TouchableOpacity
              style={styles.tileButton}
              onPress={() =>
                navigation.navigate('Quotation', {
                  projectId: project.id,
                  projectName: project.name,
                  project: project,
                })
              }
            >
              <Ionicons name="calculator-outline" size={22} color="#2E7D32" />
              <Text style={styles.tileLabel}>Quản lý Báo giá</Text>
            </TouchableOpacity>

            {project.status === 'in-progress' && (
              <TouchableOpacity
                style={styles.tileButton}
                onPress={() =>
                  navigation.navigate('MaterialPurchase', {
                    projectId: project.id,
                    projectName: project.name,
                    project: project,
                  })
                }
              >
                <Ionicons name="cart-outline" size={22} color="#2E7D32" />
                <Text style={styles.tileLabel}>Quản lý Mua Vật Tư</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.tileButton}
              onPress={() =>
                navigation.navigate('CreateDeliveryNote', {
                  projectId: project.id,
                  materials: project.materials,
                })
              }
            >
              <Ionicons
                name="document-text-outline"
                size={22}
                color="#2E7D32"
              />
              <Text style={styles.tileLabel}>Biên Bản Giao Hàng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tileButton}
              onPress={() => openAIChatWithProject(project)}
            >
              <Ionicons name="chatbubble-ellipses" size={22} color="#2E7D32" />
              <Text style={styles.tileLabel}>Tư vấn AI</Text>
            </TouchableOpacity>

            {project.driveFolderUrl ? (
              <TouchableOpacity
                style={styles.tileButton}
                onPress={() =>
                  Linking.openURL(project.driveFolderUrl).catch(() =>
                    Alert.alert('Lỗi', 'Không thể mở thư mục Google Drive')
                  )
                }
              >
                <Ionicons name="folder-open" size={22} color="#2E7D32" />
                <Text style={styles.tileLabel}>Mở thư mục Drive</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.tileButton}
                onPress={handleCreateDriveFolders}
              >
                <Ionicons name="cloud-upload" size={22} color="#2E7D32" />
                <Text style={styles.tileLabel}>Tạo thư mục Drive</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.tileButton}
              onPress={() =>
                navigation.navigate('ExpenseList', {
                  projectId: project.id,
                  projectName: project.name,
                })
              }
            >
              <Ionicons name="cash-outline" size={22} color="#2E7D32" />
              <Text style={styles.tileLabel}>Chi phí dự án</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tileButton}
              onPress={() =>
                navigation.navigate('ProjectDiscussion', {
                  projectId: project.id,
                  projectName: project.name,
                })
              }
            >
              <View style={styles.tileIconContainer}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={22}
                  color="#2E7D32"
                />
                {discussionCount > 0 && (
                  <View style={styles.discussionBadge}>
                    <Text style={styles.discussionBadgeText}>
                      {discussionCount > 99 ? '99+' : discussionCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.tileLabel}>Thảo luận dự án</Text>
            </TouchableOpacity>

            {/* Quản lý Hợp đồng: tạo từ báo giá mới nhất */}
            <TouchableOpacity
              style={styles.tileButton}
              onPress={async () => {
                if (isGeneratingContractRef.current) return;
                isGeneratingContractRef.current = true;
                try {
                  // 1) Lấy báo giá mới nhất
                  const quotationsRef = collection(
                    db,
                    `projects/${project.id}/quotations`
                  );
                  const q = query(
                    quotationsRef,
                    orderBy('createdAt', 'desc'),
                    limit(1)
                  );
                  const snap = await getDocs(q);
                  const latestQuotation = snap.empty
                    ? null
                    : { id: snap.docs[0].id, ...snap.docs[0].data() };

                  const materials =
                    latestQuotation?.materials || project.materials || [];

                  // 2) Lấy access token Google
                  const accessToken = await getAccessTokenSafe();

                  // 3) Chuẩn bị dữ liệu hợp đồng
                  const customerData = {
                    name: project.customerName || '',
                    address: project.customerAddress || '',
                    phone: project.customerPhone || '',
                    taxCode: project.customerTaxCode || '',
                  };

                  const contractData = {
                    companyName: customerData.name,
                    customerAddress: customerData.address,
                    companyPhone: customerData.phone,
                    taxCode: customerData.taxCode,
                    day: String(new Date().getDate()),
                    month: String(new Date().getMonth() + 1),
                    deliveryTime: latestQuotation?.deliveryTime || '',
                    materials,
                  };

                  // 4) Gọi Cloud Function generateContract
                  const functions = getFunctions(app, 'us-central1');
                  const generateContract = httpsCallable(
                    functions,
                    'generateContract'
                  );
                  const result = await generateContract({
                    contractData,
                    fileName: `Hop_dong_${
                      project.name || 'du_an'
                    }_${Date.now()}`,
                    projectId: project.id,
                    accessToken,
                  });

                  const { docUrl } = result.data || {};
                  if (docUrl) {
                    Alert.alert('Thành công', 'Đã tạo hợp đồng. Mở tài liệu?', [
                      { text: 'Đóng', style: 'cancel' },
                      {
                        text: 'Mở',
                        onPress: () => Linking.openURL(docUrl).catch(() => {}),
                      },
                    ]);
                  } else {
                    Alert.alert(
                      'Thông báo',
                      'Đã tạo hợp đồng nhưng không lấy được liên kết.'
                    );
                  }
                } catch (err) {
                  console.error(
                    'Generate contract from latest quotation failed:',
                    err
                  );
                  Alert.alert('Lỗi', err.message || 'Không thể tạo hợp đồng');
                } finally {
                  isGeneratingContractRef.current = false;
                }
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={22}
                color="#2E7D32"
              />
              <Text style={styles.tileLabel}>Quản lý Hợp đồng</Text>
            </TouchableOpacity>

            {/* Chia sẻ Link Theo dõi */}
            <TouchableOpacity
              style={styles.tileButton}
              onPress={async () => {
                try {
                  if (!project.publicTrackingToken) {
                    Alert.alert(
                      'Thông báo',
                      'Dự án này chưa có token theo dõi. Vui lòng liên hệ quản trị viên.'
                    );
                    return;
                  }

                  const trackingUrl = `https://tanhoaphat.netlify.app/track?token=${project.publicTrackingToken}`;

                  await Share.share({
                    message: `Theo dõi tiến độ dự án "${project.name}" của THP:\n\n${trackingUrl}\n\nLink này cho phép bạn xem tiến độ dự án theo thời gian thực mà không cần đăng nhập.`,
                    title: `Theo dõi dự án: ${project.name}`,
                    url: trackingUrl,
                  });
                } catch (error) {
                  console.error('Error sharing tracking link:', error);
                  Alert.alert('Lỗi', 'Không thể chia sẻ link theo dõi');
                }
              }}
            >
              <Ionicons name="share-social-outline" size={22} color="#2E7D32" />
              <Text style={styles.tileLabel}>Chia sẻ Link Theo dõi</Text>
            </TouchableOpacity>
          </View>
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

        {/* Thông tin cơ bản */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

          {/* Các thông tin hiện có */}
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

          {/* Thêm nút tính toán chi phí */}
          <View style={[styles.infoRow, { marginTop: 15 }]}>
            <Text style={styles.infoLabel}>Ngân sách:</Text>
            <View style={styles.budgetContainer}>
              <Text style={styles.infoValue}>
                {project.budget?.grandTotal
                  ? formatCurrency(project.budget.grandTotal)
                  : project.budget && typeof project.budget === 'number'
                  ? formatCurrency(project.budget)
                  : 'Chưa xác định'}
              </Text>
              {(currentUser?.role === 'ke_toan' ||
                currentUser?.role === 'giam_doc' ||
                currentUser?.role === 'pho_giam_doc') && (
                <TouchableOpacity
                  style={styles.budgetButton}
                  onPress={() =>
                    navigation.navigate('ProjectCost', {
                      projectId: project.id,
                    })
                  }
                >
                  <Ionicons name="calculator-outline" size={16} color="#fff" />
                  <Text style={styles.budgetButtonText}>Tính chi phí</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Thêm nút Quản lý Thanh toán */}
          <View style={[styles.infoRow, { marginTop: 15 }]}>
            <Text style={styles.infoLabel}>Thanh toán:</Text>
            <View style={styles.budgetContainer}>
              <TouchableOpacity
                style={[styles.budgetButton, { backgroundColor: '#4CAF50' }]}
                onPress={() =>
                  navigation.navigate('PaymentRequestList', {
                    projectId: project.id,
                  })
                }
              >
                <Ionicons name="cash-outline" size={16} color="#fff" />
                <Text style={styles.budgetButtonText}>Quản lý Thanh toán</Text>
              </TouchableOpacity>
            </View>
          </View>

          {project.notes && (
            <>
              <Text style={styles.notesLabel}>Ghi chú:</Text>
              <Text style={styles.notesText}>{project.notes}</Text>
            </>
          )}
        </View>

        {/* Status Change Section - Only visible for authorized roles */}
        {(currentUser?.role === 'pho_giam_doc' ||
          currentUser?.role === 'giam_doc' ||
          currentUser?.role === 'ke_toan') && (
          <View
            style={[
              styles.section,
              { backgroundColor: theme.cardBackground, marginTop: 10 },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Trạng thái dự án
            </Text>

            <View style={styles.statusActionsContainer}>
              {/* Current status display */}
              <View style={styles.currentStatusContainer}>
                <Text style={{ color: theme.textSecondary }}>
                  Trạng thái hiện tại:
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(project?.status) },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {getStatusLabel(project?.status)}
                  </Text>
                </View>
              </View>

              {/* Status transition buttons */}
              <View style={styles.statusButtonsContainer}>
                {/* Show "Mark as Production Complete" button only if the project is in progress */}
                {(project?.status === 'in_progress' ||
                  project?.status === 'in-progress') && (
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      {
                        backgroundColor: getStatusColor('production_complete'),
                      },
                    ]}
                    onPress={() => {
                      Alert.alert(
                        'Xác nhận',
                        'Đánh dấu dự án đã sản xuất xong?',
                        [
                          { text: 'Hủy', style: 'cancel' },
                          {
                            text: 'Xác nhận',
                            onPress: async () => {
                              try {
                                await updateProject(project.id, {
                                  status: 'production_complete',
                                  updatedAt: serverTimestamp(),
                                });

                                // Refresh project data
                                fetchProjectData();

                                Alert.alert(
                                  'Thành công',
                                  'Đã cập nhật trạng thái dự án'
                                );
                              } catch (error) {
                                console.error(
                                  'Error updating project status:',
                                  error
                                );
                                Alert.alert(
                                  'Lỗi',
                                  'Không thể cập nhật trạng thái dự án'
                                );
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color="#fff"
                      style={styles.statusButtonIcon}
                    />
                    <Text style={styles.statusButtonText}>
                      Đánh dấu đã sản xuất xong
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Show "Mark as Delivered" button only if the project is production_complete */}
                {project?.status === 'production_complete' && (
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      { backgroundColor: getStatusColor('delivered') },
                    ]}
                    onPress={() => {
                      Alert.alert('Xác nhận', 'Đánh dấu dự án đã giao hàng?', [
                        { text: 'Hủy', style: 'cancel' },
                        {
                          text: 'Xác nhận',
                          onPress: async () => {
                            try {
                              await updateProject(project.id, {
                                status: 'delivered',
                                updatedAt: serverTimestamp(),
                              });

                              // Refresh project data
                              fetchProjectData();

                              Alert.alert(
                                'Thành công',
                                'Đã cập nhật trạng thái dự án'
                              );
                            } catch (error) {
                              console.error(
                                'Error updating project status:',
                                error
                              );
                              Alert.alert(
                                'Lỗi',
                                'Không thể cập nhật trạng thái dự án'
                              );
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    <Ionicons
                      name="paper-plane-outline"
                      size={20}
                      color="#fff"
                      style={styles.statusButtonIcon}
                    />
                    <Text style={styles.statusButtonText}>
                      Đánh dấu đã giao hàng
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Show "Mark as Completed" button only if the project is delivered */}
                {project?.status === 'delivered' && (
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      { backgroundColor: getStatusColor('completed') },
                    ]}
                    onPress={() => {
                      Alert.alert('Xác nhận', 'Đánh dấu dự án hoàn thành?', [
                        { text: 'Hủy', style: 'cancel' },
                        {
                          text: 'Xác nhận',
                          onPress: async () => {
                            try {
                              await updateProject(project.id, {
                                status: 'completed',
                                updatedAt: serverTimestamp(),
                              });

                              // Refresh project data
                              fetchProjectData();

                              Alert.alert(
                                'Thành công',
                                'Đã cập nhật trạng thái dự án'
                              );
                            } catch (error) {
                              console.error(
                                'Error updating project status:',
                                error
                              );
                              Alert.alert(
                                'Lỗi',
                                'Không thể cập nhật trạng thái dự án'
                              );
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    <Ionicons
                      name="checkmark-done-outline"
                      size={20}
                      color="#fff"
                      style={styles.statusButtonIcon}
                    />
                    <Text style={styles.statusButtonText}>
                      Đánh dấu hoàn thành
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Quy trình Sản xuất */}
        <View style={styles.tasksBoard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quy trình Sản xuất</Text>
            {/* Remove the assignment button here */}
          </View>

          {project?.workflowStages?.length ? (
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
                  <View key={item.stageId} style={styles.stageContainer}>
                    <TouchableOpacity
                      style={styles.stageInfo}
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

                      {/* Show assigned workers */}
                      {item.assignedWorkers &&
                        item.assignedWorkers.length > 0 && (
                          <Text style={styles.assignedWorkersText}>
                            Đã giao: {item.assignedWorkers.length} người
                          </Text>
                        )}
                    </TouchableOpacity>

                    {/* Assign Workers Button */}
                    <TouchableOpacity
                      style={styles.assignButton}
                      onPress={() => handleAssignWorkers(item)}
                    >
                      <Ionicons name="person-add" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
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

        {/* Xóa nút "Phân công" thừa ở đây */}
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

      {/* Stage Assignment Modal */}
      <StageAssignmentModal
        visible={stageAssignmentModalVisible}
        onClose={() => {
          setStageAssignmentModalVisible(false);
          setSelectedStageForAssignment(null);
        }}
        onAssign={handleStageAssignment}
        projectId={projectId}
        selectedStage={selectedStageForAssignment}
        projectStages={project?.workflowStages || []}
        navigation={navigation}
      />
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
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef1f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  projectHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  projectName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
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
  statusChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  projectDescription: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginTop: 8,
  },
  infoSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef1f5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eef1f5',
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
    fontWeight: '700',
    color: '#111827',
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
    borderBottomColor: '#eef1f5',
  },
  infoLabel: {
    fontSize: 15,
    color: '#6B7280',
    flex: 1,
  },
  infoValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
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
    flexDirection: 'row',
    justifyContent: 'space-between', // Better alignment for multiple buttons
  },
  editButton: {
    backgroundColor: '#0066cc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1, // Make buttons take equal space
  },
  assignButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1, // Make buttons take equal space
    marginLeft: 10,
  },
  editButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 6,
  },
  assignButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
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
  actionsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileButton: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eef1f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  tileLabel: {
    color: '#000',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  tileIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF5722',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  discussionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  actionIcon: {
    marginRight: 10,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  budgetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  budgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066cc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  budgetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 5,
  },
  driveButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  driveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  budgetCalcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  driveButtonIcon: {
    marginRight: 8,
  },
  driveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  expenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800', // Orange color for expense tracking
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },

  currentStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statusActionsContainer: {
    marginTop: 10,
  },
  statusButtonsContainer: {
    marginTop: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 4,
    marginVertical: 5,
  },
  statusButtonIcon: {
    marginRight: 8,
  },
  statusButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  assignButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 4,
  },

  stageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageInfo: {
    flex: 1,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  assignedWorkersText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  assignButton: {
    padding: 12,
    marginRight: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
});

export default ProjectDetailScreen;
