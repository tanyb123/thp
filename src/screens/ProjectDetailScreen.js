import React, { useState, useEffect, useCallback } from 'react';
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
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProjectById, updateTaskStatus, updateCustomTask } from '../api/projectService';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import StatusIndicator from '../components/StatusIndicator';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { googleAuthConfig } from '../config/authConfig';
import * as XLSX from 'xlsx';

// Đảm bảo quá trình xác thực hoạt động đúng trên web và mobile
WebBrowser.maybeCompleteAuthSession();

// Định nghĩa danh sách công việc cố định
const TASK_DEFINITIONS = [
  { key: 'quotation', label: 'Báo giá' },
  { key: 'material_separation', label: 'Tách vật liệu' },
  { key: 'material_cutting', label: 'Cắt phôi' },
  { key: 'assembly', label: 'Lắp ráp' },
  { key: 'painting', label: 'Sơn' },
  { key: 'shipping', label: 'Vận chuyển' },
  { key: 'other', label: 'Công việc khác' }
];

// Định nghĩa các trạng thái công việc
const TASK_STATUSES = [
  { value: 'pending', label: 'Chưa thực hiện' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'completed', label: 'Hoàn thành' }
];

const ProjectDetailScreen = ({ route, navigation }) => {
  const { projectId } = route.params;
  const { currentUser } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State cho quản lý công việc
  const [customTaskModalVisible, setCustomTaskModalVisible] = useState(false);
  const [customTaskName, setCustomTaskName] = useState('');
  
  // State cho Google Authentication
  const [accessToken, setAccessToken] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // State cho Google Drive files
  const [driveFiles, setDriveFiles] = useState([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  
  // State cho dữ liệu vật tư và bảng tính
  const [materials, setMaterials] = useState([]);
  const [showMaterialsTable, setShowMaterialsTable] = useState(false);
  
  // Thêm state để hiển thị debug info
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  
  // Sử dụng scheme cố định từ cấu hình và reversed client ID cho iOS
  const REDIRECT_SCHEME = 'com.googleusercontent.apps.370615243912-o6d5f9a9l5vbui1o1gcnd5t0lbkru9is';

  const [request, response, promptAsync] = Google.useAuthRequest({
    // Sử dụng client IDs từ cấu hình
    iosClientId: googleAuthConfig.iosClientId,
    androidClientId: googleAuthConfig.androidClientId,
    webClientId: googleAuthConfig.webClientId,
    
    scopes: googleAuthConfig.driveScopes,
    
    // Sử dụng scheme cố định từ cấu hình
    redirectUri: `${REDIRECT_SCHEME}:/oauth2redirect/google`,
  });
  
  // Log để debug redirectUri và request object
  useEffect(() => {
    // Log manually constructed redirectUri
    const manualRedirectUri = `${REDIRECT_SCHEME}:/oauth2redirect/google`;
    console.log('Manual redirectUri:', manualRedirectUri);
    
    if (request) {
      console.log('Generated Auth Request:', JSON.stringify(request, null, 2));
      setDebugInfo(prevInfo => ({
        ...prevInfo,
        redirectUri: manualRedirectUri,
        request: {
          redirectUri: request.redirectUri,
          scopes: request.scopes,
          iosClientId: '370615243912-o6d5f9a9l5vbui1o1gcnd5t0lbkru9is.apps.googleusercontent.com',
          androidClientId: '370615243912-o6d5f9a9l5vbui1o1gcnd5t0lbkru9is.apps.googleusercontent.com'
        }
      }));
      setIsAuthLoading(false); // Auth service is ready
    }
  }, [request]);
  
  // Xử lý phản hồi từ Google Auth
  useEffect(() => {
    const handleAuthResponse = async () => {
      if (response) {
        console.log('Google Auth Response:', JSON.stringify(response, null, 2));
        
        // Log thông tin chi tiết về redirectUri được sử dụng
        if (response.type === 'success' || response.type === 'error') {
          console.log('Auth completed with redirectUri:', response.url);
          setDebugInfo(prevInfo => ({
            ...prevInfo,
            response: {
              type: response.type,
              url: response.url,
              error: response.error,
            }
          }));
        }
      }
      
      if (response?.type === 'success') {
        setIsAuthenticating(false);
        const { authentication } = response;
        setAccessToken(authentication.accessToken);
        console.log('Google authentication successful, access token obtained');
        
        try {
          // Lấy danh sách file Excel từ Google Drive
          const files = await fetchGoogleDriveFiles(authentication.accessToken);
          
          if (files && files.length > 0) {
            // Cập nhật state và hiển thị modal picker
            setDriveFiles(files);
            setIsPickerVisible(true);
          } else {
            Alert.alert(
              'Không tìm thấy file',
              'Không tìm thấy file Excel nào trong Google Drive của bạn. Vui lòng tải lên file Excel trước khi sử dụng tính năng này.',
              [{ text: 'OK' }]
            );
          }
        } catch (error) {
          console.error('Error fetching files after authentication:', error);
          
          // Hiển thị thông báo thành công xác thực nhưng không thể lấy file
          Alert.alert(
            'Đăng nhập thành công',
            'Bạn đã kết nối thành công với Google Drive, nhưng không thể lấy danh sách file. Vui lòng thử lại sau.',
            [{ text: 'OK' }]
          );
        }
      } else if (response?.type === 'error') {
        setIsAuthenticating(false);
        console.error('Google authentication error:', response.error);
        
        // Log chi tiết hơn về lỗi
        if (response.error?.code) {
          console.error('Error code:', response.error.code);
        }
        if (response.error?.message) {
          console.error('Error message:', response.error.message);
        }
        if (response.error?.details) {
          console.error('Error details:', response.error.details);
        }
        
        // Kiểm tra lỗi cụ thể liên quan đến redirect_uri
        const errorMessage = response.error?.message || 'Không xác định';
        if (errorMessage.includes('redirect_uri') || errorMessage.includes('redirect URI')) {
          console.error('REDIRECT URI ERROR DETECTED. This likely means the redirect URI in your Google Console does not match the one being used by Expo.');
          console.error('Please ensure your Google Console has the correct redirect URI configured for the Expo Go client.');
        }
        
        Alert.alert(
          'Lỗi đăng nhập',
          `Không thể kết nối với Google Drive. Lỗi: ${errorMessage}`,
          [{ text: 'OK' }]
        );
      }
    };
    
    // Gọi hàm xử lý khi response thay đổi
    if (response) {
      handleAuthResponse();
    }
  }, [response]);
  
  // Hàm lấy dữ liệu dự án
  const fetchProjectData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProjectById(projectId);
      
      if (data) {
        setProject(data);
        // Cập nhật tên công việc khác nếu có
        if (data.tasks && data.tasks.other && data.tasks.other.name) {
          setCustomTaskName(data.tasks.other.name);
        }
      } else {
        setError('Không tìm thấy thông tin dự án');
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin dự án:', err);
      setError('Không thể tải thông tin dự án. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };
  
  // Lấy dữ liệu dự án khi màn hình được tải
  useEffect(() => {
    fetchProjectData();
  }, [projectId]);
  
  // Làm mới dữ liệu khi màn hình được focus (quay lại sau khi chỉnh sửa)
  useFocusEffect(
    useCallback(() => {
      fetchProjectData();
    }, [projectId])
  );

  // Hàm cập nhật trạng thái công việc
  const handleUpdateTaskStatus = async (taskKey, currentStatus) => {
    if (Platform.OS === 'ios') {
      // Sử dụng ActionSheetIOS cho iOS
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...TASK_STATUSES.map(status => status.label), 'Hủy'],
          cancelButtonIndex: TASK_STATUSES.length,
          title: 'Chọn trạng thái công việc',
          message: `Cập nhật trạng thái cho "${TASK_DEFINITIONS.find(task => task.key === taskKey)?.label}"`,
        },
        async (buttonIndex) => {
          if (buttonIndex < TASK_STATUSES.length) {
            const newStatus = TASK_STATUSES[buttonIndex].value;
            try {
              await updateTaskStatus(projectId, taskKey, newStatus, currentUser?.uid);
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
        `Cập nhật trạng thái cho "${TASK_DEFINITIONS.find(task => task.key === taskKey)?.label}"`,
        [
          ...TASK_STATUSES.map(status => ({
            text: status.label,
            onPress: async () => {
              try {
                await updateTaskStatus(projectId, taskKey, status.value, currentUser?.uid);
                fetchProjectData(); // Làm mới dữ liệu dự án
              } catch (error) {
                console.error('Lỗi khi cập nhật trạng thái công việc:', error);
                Alert.alert('Lỗi', 'Không thể cập nhật trạng thái công việc');
              }
            }
          })),
          { text: 'Hủy', style: 'cancel' }
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
      await updateCustomTask(projectId, customTaskName.trim(), currentUser?.uid);
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
      Alert.alert(
        'Thông báo',
        'Dự án này chưa được gán cho khách hàng nào.'
      );
    }
  };
  
  // Hàm hiển thị thông tin debug
  const toggleDebugInfo = () => {
    setShowDebugInfo(!showDebugInfo);
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
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
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
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
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
      year: 'numeric'
    });
  };
  
  // Định dạng số tiền
  const formatCurrency = (amount) => {
    if (!amount) return '0 VNĐ';
    
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(amount);
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
      case 'quotation':
        return 'Báo giá';
      case 'material_separation':
        return 'Tách vật liệu';
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
  
  // Hàm xử lý khi người dùng chọn một file
  const handleFileSelect = async (fileId, fileName) => {
    try {
      console.log(`Downloading file: ${fileName} (${fileId})`);
      Alert.alert('Đang tải xuống', `Đang tải file "${fileName}" từ Google Drive...`);
      
      // Gọi API để tải xuống nội dung file
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
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
  
  // Hàm xử lý và hiển thị dữ liệu từ file Excel
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
          quantity: parseFloat(row[8]) || 0, // Cột I - SL
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
  
  // Hàm xử lý khi người dùng nhập đơn giá
  const handlePriceChange = (text, index) => {
    // Tạo bản sao sâu của mảng materials để tránh thay đổi trực tiếp
    const newMaterials = JSON.parse(JSON.stringify(materials));
    
    // Lấy tham chiếu đến item cụ thể đang được thay đổi
    const item = newMaterials[index];
    
    // Chuyển đổi text input thành số
    const price = parseFloat(text) || 0;
    
    // Cập nhật đơn giá của item
    item.unitPrice = price;
    
    // Tính toán thành tiền cho dòng đó
    item.totalPrice = (item.quantity || 0) * price;
    
    // Cập nhật state với mảng đã được sửa đổi
    setMaterials(newMaterials);
  };

  // Hàm xử lý nhập dữ liệu từ Google Drive
  const handleImportFromGoogleDrive = async () => {
    try {
      console.log('Starting Google Drive import process...');
      
      if (accessToken) {
        // Đã có accessToken, hiển thị danh sách file
        console.log('Already authenticated with access token');
        
        // Lấy danh sách file từ Google Drive
        const files = await fetchGoogleDriveFiles(accessToken);
        
        if (files && files.length > 0) {
          // Cập nhật state và hiển thị modal picker
          setDriveFiles(files);
          setIsPickerVisible(true);
        } else {
          Alert.alert(
            'Không tìm thấy file',
            'Không tìm thấy file Excel nào trong Google Drive của bạn. Vui lòng tải lên file Excel trước khi sử dụng tính năng này.',
            [{ text: 'OK' }]
          );
        }
        
        return;
      }
      
      console.log('Auth request status:', request ? 'Available' : 'Not available');
      
      if (!request) {
        console.error('Auth request is not available');
        Alert.alert('Lỗi', 'Không thể khởi tạo quá trình xác thực. Vui lòng thử lại sau.');
        return;
      }

      // Hiển thị trạng thái đang xác thực
      setIsAuthenticating(true);
      
      console.log('Prompting Google authentication...');
      await promptAsync();
      
      // promptAsync sẽ chuyển hướng người dùng đến trang xác thực Google
      // Kết quả sẽ được xử lý trong useEffect với response
      
    } catch (error) {
      console.error('Error in handleImportFromGoogleDrive:', error);
      setIsAuthenticating(false);
      Alert.alert('Lỗi', 'Không thể kết nối với Google Drive. Vui lòng thử lại sau.');
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
              { borderColor: getStatusColor(project.status) }
            ]}
          >
            <Text 
              style={[
                styles.statusText, 
                { color: getStatusColor(project.status) }
              ]}
            >
              {getStatusLabel(project.status)}
            </Text>
          </View>
        </View>
        
        <Text style={styles.projectDescription}>{project.description || 'Không có mô tả'}</Text>
      </View>
      
      {/* Nút nhập vật tư từ Google Drive */}
      <View style={styles.infoSection}>
        {isAuthLoading ? (
          <View style={styles.importButton}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : (
          <TouchableOpacity 
            style={[
              styles.importButton,
              isAuthenticating && styles.importButtonDisabled
            ]}
            onPress={handleImportFromGoogleDrive}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <ActivityIndicator size="small" color="#fff" style={styles.importIcon} />
            ) : (
              <Ionicons name="cloud-download-outline" size={24} color="#fff" style={styles.importIcon} />
            )}
            <Text style={styles.importButtonText}>
              {accessToken ? 'Nhập Vật Tư từ Google Drive' : 'Kết nối Google Drive'}
            </Text>
          </TouchableOpacity>
        )}
        {accessToken && (
          <Text style={styles.connectedText}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" /> Đã kết nối với Google Drive
          </Text>
        )}
        
        {/* Tiêu đề bảng vật tư */}
        {showMaterialsTable && materials.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Bảng vật tư</Text>
            
            {/* Header của bảng */}
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { flex: 3 }]}>Tên vật tư</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>SL</Text>
              <Text style={[styles.headerCell, { flex: 1 }]}>ĐVT</Text>
              <Text style={[styles.headerCell, { flex: 2 }]}>Đơn giá</Text>
              <Text style={[styles.headerCell, { flex: 2 }]}>Thành tiền</Text>
            </View>
          </>
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
              {materials.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toLocaleString('vi-VN')} đ
            </Text>
          </View>
          
          {/* Nút tiếp tục để hoàn thiện báo giá */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => {
              const subTotal = materials.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
              navigation.navigate('FinalizeQuotation', { materials, subTotal });
            }}
          >
            <Text style={styles.continueButtonText}>Tiếp tục hoàn thiện báo giá</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      
      {/* Phần thông tin khách hàng và các thông tin khác */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>
        
        <TouchableOpacity 
          style={styles.customerCard}
          onPress={navigateToCustomerDetail}
        >
          <View style={styles.customerInfo}>
            <Ionicons name="business" size={24} color="#0066cc" style={styles.customerIcon} />
            <View>
              <Text style={styles.customerName}>{project.customerName || 'Không xác định'}</Text>
              {project.customerContact && (
                <Text style={styles.customerDetail}>Người liên hệ: {project.customerContact}</Text>
              )}
              {project.customerEmail && (
                <Text style={styles.customerDetail}>Email: {project.customerEmail}</Text>
              )}
              {project.customerPhone && (
                <Text style={styles.customerDetail}>SĐT: {project.customerPhone}</Text>
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
            {project.startDate ? formatDate(project.startDate) : 'Chưa xác định'}
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
            {project.durationInDays ? `${project.durationInDays} ngày` : 'Chưa xác định'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vị trí thi công:</Text>
          <Text style={styles.infoValue}>
            {project.location === 'workshop' ? 'Tại xưởng' : 
             project.location === 'site' ? 'Tại công trình' : 'Chưa xác định'}
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
              if (taskDef.key === 'other' && (!taskData?.name || taskData.name === '')) {
                return (
                  <TouchableOpacity
                    key={taskDef.key}
                    style={styles.taskRow}
                    onPress={() => setCustomTaskModalVisible(true)}
                  >
                    <StatusIndicator status={taskData?.status || 'pending'} size={18} />
                    <View style={styles.taskContent}>
                      <Text style={styles.taskNamePlaceholder}>
                        Thêm công việc khác...
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color="#0066cc" />
                  </TouchableOpacity>
                );
              }
              
              // Nếu là công việc "other" và đã có tên
              if (taskDef.key === 'other' && taskData?.name) {
                return (
                  <TouchableOpacity
                    key={taskDef.key}
                    style={styles.taskRow}
                    onPress={() => handleUpdateTaskStatus(taskDef.key, taskData.status)}
                    activeOpacity={0.7}
                  >
                    <StatusIndicator status={taskData?.status || 'pending'} size={18} />
                    <View style={styles.taskContent}>
                      <Text style={styles.taskName} numberOfLines={1} ellipsizeMode="tail">
                        {taskData.name}
                      </Text>
                      <Text style={[
                        styles.taskStatusText,
                        { color: getTaskStatusColor(taskData?.status) }
                      ]}>
                        {getTaskStatusLabel(taskData?.status)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => setCustomTaskModalVisible(true)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="create-outline" size={20} color="#0066cc" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }
              
              // Các công việc thông thường
              return (
                <TouchableOpacity
                  key={taskDef.key}
                  style={styles.taskRow}
                  onPress={() => handleUpdateTaskStatus(taskDef.key, taskData?.status)}
                  activeOpacity={0.7}
                >
                  <StatusIndicator status={taskData?.status || 'pending'} size={18} />
                  <View style={styles.taskContent}>
                    <Text style={styles.taskName} numberOfLines={1} ellipsizeMode="tail">
                      {taskDef.label}
                    </Text>
                    <Text style={[
                      styles.taskStatusText,
                      { color: getTaskStatusColor(taskData?.status) }
                    ]}>
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
        <View style={styles.placeholder} />
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
              <Text style={[styles.tableCell, { flex: 1 }]}>
                {item.quantity.toLocaleString('vi-VN')}
              </Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>
                {item.unit}
              </Text>
              <View style={[styles.tableCell, { flex: 2 }]}>
                <TextInput
                  style={styles.priceInput}
                  value={item.unitPrice > 0 ? item.unitPrice.toString() : ''}
                  onChangeText={(text) => handlePriceChange(text, index)}
                  placeholder="Nhập..."
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>
              <Text style={[styles.tableCell, styles.totalPrice, { flex: 2 }]}>
                {item.totalPrice > 0 ? item.totalPrice.toLocaleString('vi-VN') : ''}
              </Text>
            </View>
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
      <TouchableOpacity
        style={styles.debugButton}
        onPress={toggleDebugInfo}
      >
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
                      <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                        {item.name}
                      </Text>
                      <Text style={styles.fileDate}>
                        {new Date(item.modifiedTime).toLocaleDateString('vi-VN')}
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
                iOS URL Scheme: {REDIRECT_SCHEME}
              </Text>
              
              {debugInfo.redirectUri && (
                <Text style={styles.debugText}>
                  Manual Redirect URI: {debugInfo.redirectUri}
                </Text>
              )}
              
              {debugInfo.request && (
                <>
                  <Text style={styles.debugText}>
                    Request Redirect URI: {debugInfo.request.redirectUri || 'N/A'}
                  </Text>
                  <Text style={styles.debugText}>
                    iOS Client ID: {debugInfo.request.iosClientId ? '✓ Set' : '✗ Not Set'}
                  </Text>
                  <Text style={styles.debugText}>
                    Android Client ID: {debugInfo.request.androidClientId ? '✓ Set' : '✗ Not Set'}
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
                {accessToken ? '✓ Token Available' : '✗ No Token'}
              </Text>
              
              {accessToken && (
                <Text style={styles.debugText}>
                  Token: {accessToken.substring(0, 10)}...
                </Text>
              )}
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
  placeholder: {
    width: 24,
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
});

export default ProjectDetailScreen;