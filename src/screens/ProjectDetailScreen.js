//src/screens/ProjectDetailScreen.js
import React, { useState, useEffect, useCallback, memo } from 'react';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getProjectById,
  updateTaskStatus,
  updateCustomTask,
  deleteProject,
} from '../api/projectService';
import { getQuotationsByProject } from '../api/quotationService';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import StatusIndicator from '../components/StatusIndicator';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useProjectDetails } from '../hooks/useProjectDetails';
import { useMaterialsProcessor } from '../hooks/useMaterialsProcessor';

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

// Memoized row component for the materials list
const MaterialRow = memo(({ item, index, onPriceChange, formatNumber }) => {
  return (
    <View style={styles.tableRow}>
      <View style={[styles.tableCell, { flex: 3 }]}>
        <Text style={styles.materialName}>{item.name}</Text>
        {item.material ? (
          <Text style={styles.materialType}>{item.material}</Text>
        ) : null}
        {item.quyCach ? (
          <Text style={styles.materialType}>Quy cách: {item.quyCach}</Text>
        ) : null}
      </View>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
        {formatNumber(item.quantity)}
      </Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
        {formatNumber(item.weight)}
      </Text>
      <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
        {item.unit}
      </Text>
      <View style={[styles.tableCell, { flex: 2 }]}>
        <TextInput
          style={styles.priceInput}
          value={item.unitPrice > 0 ? item.unitPrice.toString() : ''}
          onChangeText={(text) => onPriceChange(text, index)}
          placeholder="Nhập..."
          keyboardType="numeric"
          selectTextOnFocus
        />
      </View>
      <Text style={[styles.tableCell, styles.totalPrice, { flex: 2 }]}>
        {item.totalPrice > 0 ? item.totalPrice.toLocaleString('vi-VN') : ''}
      </Text>
    </View>
  );
});

const ProjectDetailScreen = ({ route, navigation }) => {
  const { projectId } = route.params;
  const { currentUser } = useAuth();
  const { project, loading, error, fetchProjectData } =
    useProjectDetails(projectId);
  const {
    materials,
    showMaterialsTable,
    driveFiles,
    isPickerVisible,
    isLoadingFiles,
    isGoogleDriveLoading,
    handleImportFromGoogleDrive,
    handleFileSelect,
    handlePriceChange,
    handleRequote,
    setIsPickerVisible,
  } = useMaterialsProcessor();

  // State cho quản lý công việc
  const [customTaskModalVisible, setCustomTaskModalVisible] = useState(false);
  const [customTaskName, setCustomTaskName] = useState('');

  // State for quotation history
  const [quotations, setQuotations] = useState([]);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(true);

  // State cho dữ liệu vật tư và bảng tính - MOVED TO HOOK
  // const [materials, setMaterials] = useState([]);
  // const [showMaterialsTable, setShowMaterialsTable] = useState(false);

  // Thêm state để hiển thị debug info
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});

  // Lấy dữ liệu báo giá khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      const loadQuotations = async () => {
        setIsLoadingQuotations(true);
        try {
          const pastQuotations = await getQuotationsByProject(projectId);
          setQuotations(pastQuotations);
        } catch (error) {
          console.error('Lỗi khi tải lịch sử báo giá:', error);
          Alert.alert('Lỗi', 'Không thể tải lịch sử báo giá.');
        } finally {
          setIsLoadingQuotations(false);
        }
      };

      if (projectId) {
        loadQuotations();
      }
    }, [projectId])
  );

  useEffect(() => {
    if (project?.tasks?.other?.name) {
      setCustomTaskName(project.tasks.other.name);
    }
  }, [project]);

  // Hàm cập nhật trạng thái công việc
  const handleUpdateTaskStatus = async (taskKey, currentStatus) => {
    if (Platform.OS === 'ios') {
      // Sử dụng ActionSheetIOS cho iOS
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...TASK_STATUSES.map((status) => status.label), 'Hủy'],
          cancelButtonIndex: TASK_STATUSES.length,
          title: 'Chọn trạng thái công việc',
          message: `Cập nhật trạng thái cho "${
            TASK_DEFINITIONS.find((task) => task.key === taskKey)?.label
          }"`,
        },
        async (buttonIndex) => {
          if (buttonIndex < TASK_STATUSES.length) {
            const newStatus = TASK_STATUSES[buttonIndex].value;
            try {
              await updateTaskStatus(
                projectId,
                taskKey,
                newStatus,
                currentUser?.uid
              );
              fetchProjectData(); // Làm mới dữ liệu dự án
            } catch (error) {
              console.error('Lỗi khi cập nhật trạng thái công việc:', error);
              Alert.alert('Lỗi', 'Không thể cập nhật trạng thái công việc');
            }
          }
        }
      );
    } else {
      // Sử dụng Alert cho Android
      Alert.alert(
        'Chọn trạng thái công việc',
        `Cập nhật trạng thái cho "${
          TASK_DEFINITIONS.find((task) => task.key === taskKey)?.label
        }"`,
        [
          ...TASK_STATUSES.map((status) => ({
            text: status.label,
            onPress: async () => {
              try {
                await updateTaskStatus(
                  projectId,
                  taskKey,
                  status.value,
                  currentUser?.uid
                );
                fetchProjectData(); // Làm mới dữ liệu dự án
              } catch (error) {
                console.error('Lỗi khi cập nhật trạng thái công việc:', error);
                Alert.alert('Lỗi', 'Không thể cập nhật trạng thái công việc');
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
      fetchProjectData(); // Làm mới dữ liệu dự án
    } catch (error) {
      console.error('Lỗi khi cập nhật tên công việc khác:', error);
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

  // Hàm hiển thị thông tin debug
  const toggleDebugInfo = () => {
    setShowDebugInfo(!showDebugInfo);
  };

  // Hàm xoá dự án
  const handleDeleteProject = async () => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc chắn muốn xoá dự án này? Thao tác này không thể hoàn tác.',
      [
        {
          text: 'Huỷ',
          style: 'cancel',
        },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProject(projectId);
              Alert.alert('Thành công', 'Đã xoá dự án.');
              // Go back to the previous screen (ProjectManagementScreen)
              navigation.goBack();
            } catch (error) {
              console.error('Lỗi khi xoá dự án:', error);
              if (error.code === 'permission-denied') {
                Alert.alert(
                  'Lỗi quyền',
                  'Bạn không có đủ quyền để thực hiện hành động này.'
                );
              } else {
                Alert.alert('Lỗi', 'Không thể xoá dự án.');
              }
            }
          },
        },
      ],
      { cancelable: true }
    );
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
    if (!timestamp) return 'Không có';

    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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

  const formatAppNumber = (num) => {
    if (typeof num !== 'number' || isNaN(num)) {
      return '0';
    }

    // Làm tròn đến 1 chữ số thập phân
    const roundedNum = Math.round(num * 10) / 10;

    // Chuyển thành chuỗi và thay thế dấu chấm thập phân bằng dấu phẩy
    return roundedNum.toString().replace('.', ',');
  };

  // Lấy màu sắc theo trạng thái dự án
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#4CAF50'; // xanh lá
      case 'in-progress':
        return '#2196F3'; // xanh dương
      case 'pending':
        return '#FF9800'; // cam
      case 'cancelled':
        return '#F44336'; // đỏ
      default:
        return '#9E9E9E'; // xám
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
        return status || 'Không xác định';
    }
  };

  // Lấy màu sắc theo trạng thái công việc
  const getTaskStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#4CAF50'; // xanh lá
      case 'in_progress':
        return '#2196F3'; // xanh dương
      case 'pending':
        return '#FF9800'; // cam
      default:
        return '#9E9E9E'; // xám
    }
  };

  // Lấy nhãn hiển thị cho trạng thái công việc
  const getTaskStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'in_progress':
        return 'Đang thực hiện';
      case 'pending':
        return 'Chờ xử lý';
      default:
        return status || 'Không xác định';
    }
  };

  // Lấy tên hiển thị cho công việc
  const getTaskDisplayName = (taskKey) => {
    switch (taskKey) {
      case 'material_separation':
        return 'Bóc tách vật tư';
      case 'quotation':
        return 'Báo giá';
      case 'material_cutting':
        return 'Cắt phôi';
      case 'assembly':
        return 'Lắp ráp';
      case 'painting':
        return 'Sơn';
      case 'shipping':
        return 'Vận chuyển';
      case 'other':
        return project?.tasks?.other?.name || 'Công việc khác';
      default:
        return taskKey;
    }
  };

  // Hàm lấy danh sách file Excel từ Google Drive
  // MOVED TO useMaterialsProcessor HOOK
  /*
  const fetchGoogleDriveFiles = async (token) => {
    console.log("Using Access Token to fetch files:", token);
    setIsLoadingFiles(true);
    
    const baseUrl = 'https://www.googleapis.com/drive/v3/files';
    
    // Use URLSearchParams to safely build the query string
    const params = new URLSearchParams();
    params.append('q', "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false");
    params.append('orderBy', 'modifiedTime desc');
    params.append('fields', 'files(id, name, modifiedTime, iconLink)');
    
    const url = `${baseUrl}?${params.toString()}`;
    
    console.log('Fetching URL:', url); // CRITICAL: This log will show us the exact URL being called.

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // If response is not 2xx, throw an error with status
        throw new Error(`Google Drive API error: ${response.status}`);
      }

      const json = await response.json();
      console.log('Google Drive files fetched:', (json.files || []).length);
      return json.files || []; // Return files array or an empty array if it doesn't exist

    } catch (error) {
      console.error('Error in fetchGoogleDriveFiles:', error);
      Alert.alert('Lỗi', 'Không thể lấy danh sách file từ Google Drive. Vui lòng thử lại sau.');
      // Re-throw the error to be caught by the calling function
      throw error;
    } finally {
      setIsLoadingFiles(false);
    }
  };
  */

  // Hàm xử lý khi người dùng chọn một file
  // MOVED TO useMaterialsProcessor HOOK
  /*
  const handleFileSelect = async (fileId, fileName) => {
    try {
      console.log(`Downloading file: ${fileName} (${fileId})`);
      Alert.alert('Đang tải xuống', `Đang tải file "${fileName}" từ Google Drive...`);
      
      // Lấy lại token để đảm bảo nó còn hiệu lực
      const tokens = await GoogleSignin.getTokens();
      const freshAccessToken = tokens.accessToken;
      
      if (!freshAccessToken) {
        Alert.alert('Lỗi', 'Phiên đăng nhập đã hết hạn. Vui lòng thử lại.');
        return;
      }
      
      // Gọi API để tải xuống nội dung file
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${freshAccessToken}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Download error: ${response.status} ${response.statusText}`);
      }
      
      // Chuyển đổi response thành blob
      const blob = await response.blob();
      
      // Đọc blob thành base64
      const reader = new FileReader();
      reader.onload = () => {
        try {
          // Lấy phần base64 từ kết quả đọc file
          const base64 = reader.result.split(',')[1];
          
          console.log('Excel file loaded, processing data...');
          
          // Truyền trực tiếp base64 data cho hàm xử lý
          parseAndDisplayData(base64, fileName);
          
          // Đóng modal picker
          setIsPickerVisible(false);
        } catch (error) {
          console.error('Error parsing Excel file:', error);
          Alert.alert('Lỗi', 'Không thể đọc file Excel. Định dạng file không hợp lệ hoặc bị lỗi.');
        }
      };
      
      reader.onerror = () => {
        console.error('FileReader error');
        Alert.alert('Lỗi', 'Không thể đọc file. Vui lòng thử lại sau.');
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Lỗi', 'Không thể tải xuống file từ Google Drive. Vui lòng thử lại sau.');
    }
  };
  */

  // Hàm xử lý và hiển thị dữ liệu từ file Excel
  // MOVED TO useMaterialsProcessor HOOK
  /*
  const parseAndDisplayData = (base64Data, fileName) => {
    try {
      // Đọc workbook từ base64
      const workbook = XLSX.read(base64Data, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // CRITICAL CHANGE: Parse to an array of arrays, ignoring headers
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      console.log('Raw Excel data rows:', rawData.length);
      
      const materials = [];
      // Bắt đầu lặp từ hàng cụ thể để bỏ qua các header phức tạp
      // Chúng ta cần tìm hàng dữ liệu thực tế đầu tiên
      for (let i = 4; i < rawData.length; i++) {
        const row = rawData[i];
        
        // Bỏ qua hàng trống hoặc tiêu đề phần (như "GIANG NGOÀI")
        if (!row || !row[1] || typeof row[8] !== 'number') {
          continue;
        }
        
        // Ánh xạ thủ công các cột theo INDEX (0-based)
        const materialItem = {
          stt: row[0],
          name: row[1] || '', // Cột B - Tên gọi
          material: row[2] || '', // Cột C - Vật liệu
          quyCach: row[3] && row[4] ? `${row[3]}x${row[4]}` : '', // Kết hợp cột D, E
          unit: row[6] || '', // Cột G - ĐVT
          quantity: parseFloat(row[7]) || 0, // Cột H (index 7) - Số lượng
          weight: parseFloat(row[8]) || 0, // Cột I (index 8) - Khối lượng
          unitPrice: 0, // Đơn giá - Sẽ được người dùng nhập
          totalPrice: 0, // Thành tiền - Sẽ được tính toán
        };
        
        materials.push(materialItem);
      }
      
      console.log('Parsed Materials:', materials.length, 'items');
      
      // Cập nhật state với dữ liệu đã được cấu trúc
      setMaterials(materials);
      setShowMaterialsTable(true);
      
      // Thông báo thành công
      Alert.alert(
        'Nhập dữ liệu thành công',
        `Đã nhập ${materials.length} dòng dữ liệu từ file "${fileName}". Vui lòng nhập đơn giá cho từng vật tư.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error processing Excel data:', error);
      Alert.alert('Lỗi', 'Không thể xử lý dữ liệu Excel. Định dạng không đúng cấu trúc yêu cầu.');
    }
  };
  */

  // Hàm xử lý khi người dùng nhập đơn giá
  // MOVED TO useMaterialsProcessor HOOK
  /*
  const handlePriceChange = (text, index) => {
    // Tạo bản sao sâu của mảng materials để tránh thay đổi trực tiếp
    const newMaterials = JSON.parse(JSON.stringify(materials));
    
    // Lấy tham chiếu đến item cụ thể đang được thay đổi
    const item = newMaterials[index];
    
    // Chuyển đổi text input thành số
    const price = parseFloat(text) || 0;
    
    // Cập nhật đơn giá của item
    item.unitPrice = price;
    
    // Tính toán thành tiền cho dòng đó theo công thức mới
    item.totalPrice = (item.quantity || 0) * (item.weight || 0) * price;
    
    // Cập nhật state với mảng đã được sửa đổi
    setMaterials(newMaterials);
  };
  */

  // MOVED TO useMaterialsProcessor HOOK
  /*
  const handleImportFromGoogleDrive = async () => {
    setIsGoogleDriveLoading(true);
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        await GoogleSignin.signIn();
      }

      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;
      
      if (!accessToken) {
        throw new Error("Không thể lấy được access token.");
      }

      const files = await fetchGoogleDriveFiles(accessToken);
      
      if (files && files.length > 0) {
        setDriveFiles(files);
        setIsPickerVisible(true);
      } else {
        Alert.alert(
          'Không tìm thấy file',
          'Không tìm thấy file Excel nào trong Google Drive của bạn. Vui lòng tải lên file Excel trước khi sử dụng tính năng này.'
        );
      }
    } catch (error) {
      console.error('Lỗi khi thao tác với Google Drive:', error);

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Đang xử lý', 'Quá trình đăng nhập đang diễn ra.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Dịch vụ không có sẵn', 'Google Play Services không có sẵn hoặc đã lỗi thời.');
      } else {
        Alert.alert(
          'Lỗi',
          'Đã xảy ra lỗi khi kết nối với Google Drive. Vui lòng thử lại.'
        );
      }
    } finally {
      setIsGoogleDriveLoading(false);
    }
  };
  */

  const handleViewPdf = async (pdfUrl, quotationNumber) => {
    if (!pdfUrl) {
      Alert.alert('Lỗi', 'Không tìm thấy đường dẫn PDF cho báo giá này.');
      return;
    }

    Alert.alert('Đang xử lý', 'Đang tải file PDF để xem...');
    try {
      const fileUri =
        FileSystem.documentDirectory + `${quotationNumber || 'quotation'}.pdf`;
      console.log('Downloading PDF from URL:', pdfUrl);
      const { uri } = await FileSystem.downloadAsync(pdfUrl, fileUri);
      console.log('File downloaded to:', uri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Mở hoặc chia sẻ PDF' });
      } else {
        Alert.alert(
          'Không thể chia sẻ',
          'Thiết bị của bạn không hỗ trợ chức năng này.'
        );
      }
    } catch (error) {
      console.error('Error handling PDF view:', error);
      Alert.alert('Lỗi', 'Không thể mở file PDF. Vui lòng thử lại.');
    }
  };

  // Tạo các components cho header và footer của FlatList
  const renderListHeader = () => (
    <>
      <View style={styles.projectHeader}>
        <Text style={styles.projectName}>{project.name || 'Chưa có tên'}</Text>

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

      {/* Nút nhập vật tư từ Google Drive */}
      <View style={styles.infoSection}>
        <TouchableOpacity
          style={[
            styles.importButton,
            isGoogleDriveLoading && styles.importButtonDisabled,
          ]}
          onPress={handleImportFromGoogleDrive}
          disabled={isGoogleDriveLoading}
        >
          {isGoogleDriveLoading ? (
            <ActivityIndicator
              size="small"
              color="#fff"
              style={styles.importIcon}
            />
          ) : (
            <Ionicons
              name="cloud-download-outline"
              size={24}
              color="#fff"
              style={styles.importIcon}
            />
          )}
          <Text style={styles.importButtonText}>
            Nhập Vật Tư từ Google Drive
          </Text>
        </TouchableOpacity>

        {materials.length > 0 && showMaterialsTable && (
          <View style={styles.materialsHeader}>
            {/* Header của bảng */}
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { flex: 3 }]}>Tên vật tư</Text>
              <Text
                style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}
              >
                SL
              </Text>
              <Text
                style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}
              >
                KL
              </Text>
              <Text
                style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}
              >
                ĐVT
              </Text>
              <Text
                style={[styles.headerCell, { flex: 2, textAlign: 'right' }]}
              >
                Đơn giá
              </Text>
              <Text
                style={[styles.headerCell, { flex: 2, textAlign: 'right' }]}
              >
                Thành tiền
              </Text>
            </View>
          </View>
        )}
      </View>
    </>
  );

  const renderListFooter = () => (
    <>
      {/* Tổng cộng */}
      {showMaterialsTable && materials.length > 0 && (
        <View style={[styles.infoSection, { paddingTop: 0 }]}>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>Tổng cộng:</Text>
            <Text style={styles.summaryValue}>
              {materials
                .reduce((sum, item) => sum + (item.totalPrice || 0), 0)
                .toLocaleString('vi-VN')}{' '}
              đ
            </Text>
          </View>

          {/* Nút tiếp tục để hoàn thiện báo giá */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => {
              const subTotal = materials.reduce(
                (sum, item) => sum + (item.totalPrice || 0),
                0
              );

              // Tạo đối tượng customerData từ thông tin dự án
              const customerData = {
                id: project.customerId || '',
                name: project.customerName || 'Khách hàng',
                address: project.customerAddress || '',
                phone: project.customerPhone || '',
                email: project.customerEmail || '',
                contact: project.customerContact || '',
              };

              // Truyền thêm projectId và customerData khi chuyển màn hình
              navigation.navigate('FinalizeQuotation', {
                materials,
                subTotal,
                projectId,
                projectName: project.name || 'Dự án mới',
                customerData,
              });
            }}
          >
            <Text style={styles.continueButtonText}>
              Tiếp tục hoàn thiện báo giá
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Quotation History Section */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Lịch sử báo giá</Text>
        {isLoadingQuotations ? (
          <ActivityIndicator size="small" color="#0066cc" />
        ) : quotations.length === 0 ? (
          <Text style={styles.emptyText}>
            Chưa có báo giá nào được tạo cho dự án này.
          </Text>
        ) : (
          <View style={styles.historyContainer}>
            {quotations.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.historyItem,
                  index > 0 && styles.historyItemBorder,
                ]}
              >
                <View style={styles.historyInfo}>
                  <Text style={styles.historyNumber}>
                    {item.quotationNumber ||
                      `Báo giá #${item.id.substring(0, 5)}`}
                  </Text>
                  <Text style={styles.historyDate}>
                    Ngày tạo:{' '}
                    {item.createdAt
                      ? new Date(
                          item.createdAt.seconds * 1000
                        ).toLocaleDateString('vi-VN')
                      : 'Không rõ'}
                  </Text>
                  <Text style={styles.historyTotal}>
                    Tổng cộng: {formatCurrency(item.grandTotal)}
                  </Text>
                </View>
                <View style={styles.historyActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() =>
                      handleViewPdf(item.pdfUrl, item.quotationNumber)
                    }
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="#0066cc"
                    />
                    <Text style={styles.actionButtonText}>Xem PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.requoteButton]}
                    onPress={() => handleRequote(item)}
                  >
                    <Ionicons name="copy-outline" size={20} color="#4CAF50" />
                    <Text
                      style={[styles.actionButtonText, { color: '#4CAF50' }]}
                    >
                      Báo giá lại
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
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
            {project.budget ? formatCurrency(project.budget) : 'Chưa xác định'}
          </Text>
        </View>

        {project.notes && (
          <>
            <Text style={styles.notesLabel}>Ghi chú:</Text>
            <Text style={styles.notesText}>{project.notes}</Text>
          </>
        )}
      </View>

      {/* Phần danh sách công việc */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Hạng mục công việc</Text>

        {!project?.tasks ? (
          <View style={styles.emptyTasksContainer}>
            <Ionicons name="list-outline" size={40} color="#ccc" />
            <Text style={styles.emptyTasksText}>
              Không có thông tin hạng mục công việc
            </Text>
          </View>
        ) : (
          <View style={styles.tasksBoard}>
            {TASK_DEFINITIONS.map((taskDef) => {
              const taskData = project.tasks[taskDef.key];

              // Nếu là công việc "other" và chưa có tên
              if (
                taskDef.key === 'other' &&
                (!taskData?.name || taskData.name === '')
              ) {
                return (
                  <TouchableOpacity
                    key={taskDef.key}
                    style={styles.taskRow}
                    onPress={() => setCustomTaskModalVisible(true)}
                  >
                    <StatusIndicator
                      status={taskData?.status || 'pending'}
                      size={18}
                    />
                    <View style={styles.taskContent}>
                      <Text style={styles.taskNamePlaceholder}>
                        Thêm công việc khác...
                      </Text>
                    </View>
                    <Ionicons
                      name="add-circle-outline"
                      size={24}
                      color="#0066cc"
                    />
                  </TouchableOpacity>
                );
              }

              // Nếu là công việc "other" và đã có tên
              if (taskDef.key === 'other' && taskData?.name) {
                return (
                  <TouchableOpacity
                    key={taskDef.key}
                    style={styles.taskRow}
                    onPress={() =>
                      handleUpdateTaskStatus(taskDef.key, taskData.status)
                    }
                    activeOpacity={0.7}
                  >
                    <StatusIndicator
                      status={taskData?.status || 'pending'}
                      size={18}
                    />
                    <View style={styles.taskContent}>
                      <Text
                        style={styles.taskName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {taskData.name}
                      </Text>
                      <Text
                        style={[
                          styles.taskStatusText,
                          { color: getTaskStatusColor(taskData?.status) },
                        ]}
                      >
                        {getTaskStatusLabel(taskData?.status)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => setCustomTaskModalVisible(true)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color="#0066cc"
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }

              // Các công việc thông thường
              return (
                <TouchableOpacity
                  key={taskDef.key}
                  style={styles.taskRow}
                  onPress={() =>
                    handleUpdateTaskStatus(taskDef.key, taskData?.status)
                  }
                  activeOpacity={0.7}
                >
                  <StatusIndicator
                    status={taskData?.status || 'pending'}
                    size={18}
                  />
                  <View style={styles.taskContent}>
                    <Text
                      style={styles.taskName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {taskDef.label}
                    </Text>
                    <Text
                      style={[
                        styles.taskStatusText,
                        { color: getTaskStatusColor(taskData?.status) },
                      ]}
                    >
                      {getTaskStatusLabel(taskData?.status)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </>
  );

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

      {/* Sử dụng FlatList làm component chính cho cuộn trang */}
      {showMaterialsTable && materials.length > 0 ? (
        <FlatList
          style={styles.contentContainer}
          contentContainerStyle={styles.materialsTable}
          data={materials}
          keyExtractor={(item, index) => `material-${index}`}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderListFooter}
          renderItem={({ item, index }) => (
            <MaterialRow
              item={item}
              index={index}
              onPriceChange={handlePriceChange}
              formatNumber={formatAppNumber}
            />
          )}
        />
      ) : (
        <FlatList
          style={styles.contentContainer}
          data={[{ key: 'empty' }]} // Dummy data để FlatList hiển thị
          renderItem={null}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderListFooter}
        />
      )}

      {/* Debug button */}
      <TouchableOpacity style={styles.debugButton} onPress={toggleDebugInfo}>
        <Text style={styles.debugButtonText}>Debug</Text>
      </TouchableOpacity>

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

      {/* Modal picker cho Google Drive files */}
      <Modal
        visible={isPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setIsPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.filePickerContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn file Excel</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsPickerVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {isLoadingFiles ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0066cc" />
                <Text style={{ marginTop: 10, textAlign: 'center' }}>
                  Đang tải danh sách file...
                </Text>
              </View>
            ) : driveFiles.length === 0 ? (
              <View style={styles.emptyFilesContainer}>
                <Ionicons name="document-outline" size={48} color="#ccc" />
                <Text style={styles.emptyFilesText}>
                  Không tìm thấy file Excel nào trong Google Drive của bạn
                </Text>
              </View>
            ) : (
              <FlatList
                style={styles.fileList}
                data={driveFiles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.fileItem}
                    onPress={() => handleFileSelect(item.id, item.name)}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={36}
                      color="#4CAF50"
                      style={styles.fileIcon}
                    />
                    <View style={styles.fileDetails}>
                      <Text
                        style={styles.fileName}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.fileDate}>
                        {new Date(item.modifiedTime).toLocaleDateString(
                          'vi-VN'
                        )}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal hiển thị debug info */}
      <Modal
        visible={showDebugInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDebugInfo(false)}
      >
        <View style={styles.debugModalContainer}>
          <View style={styles.debugModalContent}>
            <Text style={styles.debugModalTitle}>Debug Information</Text>

            <ScrollView style={styles.debugScrollView}>
              <Text style={styles.debugSectionTitle}>Auth Configuration:</Text>
              <Text style={styles.debugText}>
                Web Client ID:
                370615243912-o6d5f9a9l5vbui1o1gcnd5t0lbkru9is.apps.googleusercontent.com
              </Text>

              {debugInfo.redirectUri && (
                <Text style={styles.debugText}>
                  Manual Redirect URI: {debugInfo.redirectUri}
                </Text>
              )}

              {debugInfo.request && (
                <>
                  <Text style={styles.debugText}>
                    Request Redirect URI:{' '}
                    {debugInfo.request.redirectUri || 'N/A'}
                  </Text>
                  <Text style={styles.debugText}>
                    iOS Client ID:{' '}
                    {debugInfo.request.iosClientId ? '✓ Set' : '✗ Not Set'}
                  </Text>
                  <Text style={styles.debugText}>
                    Android Client ID:{' '}
                    {debugInfo.request.androidClientId ? '✓ Set' : '✗ Not Set'}
                  </Text>
                </>
              )}

              {debugInfo.response && (
                <>
                  <Text style={styles.debugSectionTitle}>Auth Response:</Text>
                  <Text style={styles.debugText}>
                    Type: {debugInfo.response.type || 'N/A'}
                  </Text>
                  {debugInfo.response.url && (
                    <Text style={styles.debugText}>
                      Callback URL: {debugInfo.response.url}
                    </Text>
                  )}
                  {debugInfo.response.error && (
                    <Text style={styles.debugErrorText}>
                      Error: {JSON.stringify(debugInfo.response.error)}
                    </Text>
                  )}
                </>
              )}

              <Text style={styles.debugSectionTitle}>Access Token:</Text>
              <Text style={styles.debugText}>
                {/* Sửa lỗi: Không còn state accessToken, tạm thời bỏ hiển thị */}
                Token status is no longer tracked in component state.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.debugCloseButton}
              onPress={() => setShowDebugInfo(false)}
            >
              <Text style={styles.debugCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    flex: 1,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  tasksList: {
    flex: 1,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  taskCheckbox: {
    padding: 4,
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
  taskNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskStatus: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  editTaskButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyTasksContainer: {
    flex: 1,
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
  tasksBoard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskNamePlaceholder: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    flex: 1,
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
  editButton: {
    padding: 8,
    marginLeft: 8,
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
  importButton: {
    backgroundColor: '#4285F4', // Google blue
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 10,
  },
  importButtonDisabled: {
    backgroundColor: '#A4C2F4', // Light Google blue
    opacity: 0.8,
  },
  importIcon: {
    marginRight: 10,
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  connectedText: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 8,
  },
  debugButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 999,
  },
  debugButtonText: {
    color: 'white',
    fontSize: 12,
  },
  debugModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  debugModalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  debugModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  debugScrollView: {
    maxHeight: 400,
  },
  debugSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  debugText: {
    fontSize: 14,
    marginBottom: 5,
  },
  debugErrorText: {
    fontSize: 14,
    marginBottom: 5,
    color: 'red',
  },
  debugCloseButton: {
    marginTop: 15,
    backgroundColor: '#0066cc',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignSelf: 'center',
  },
  debugCloseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Styles cho file picker modal
  filePickerContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    maxWidth: 500,
  },
  fileList: {
    maxHeight: 400,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fileIcon: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  fileDate: {
    fontSize: 12,
    color: '#666',
  },
  emptyFilesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyFilesText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Styles cho bảng vật tư
  materialsContainer: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  materialsTable: {
    backgroundColor: '#fff',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    marginBottom: 8,
  },
  headerCell: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  tableCell: {
    paddingHorizontal: 4,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  materialType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 6,
    fontSize: 14,
    width: '100%',
    textAlign: 'right',
  },
  totalPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0066cc',
    textAlign: 'right',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  placeholder: {
    width: 24,
  },
  // Quotation History Styles
  historyContainer: {
    marginTop: 10,
  },
  historyItem: {
    paddingVertical: 12,
  },
  historyItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  historyInfo: {
    marginBottom: 12,
  },
  historyNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  historyDate: {
    fontSize: 14,
    color: '#666',
    marginVertical: 4,
  },
  historyTotal: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  historyActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
  },
  requoteButton: {},
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#0066cc',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default ProjectDetailScreen;
