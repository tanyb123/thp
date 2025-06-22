//src/hooks/useMaterialsProcessor.js
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { functions } from '../config/firebaseConfig'; // Import functions instance
import { httpsCallable } from 'firebase/functions'; // Import httpsCallable
import { getAuth } from 'firebase/auth'; // Thêm import getAuth

export const useMaterialsProcessor = () => {
  // State for materials data and table visibility
  const [materials, setMaterials] = useState([]);
  const [showMaterialsTable, setShowMaterialsTable] = useState(false);

  // State for Google Drive integration
  const [driveFiles, setDriveFiles] = useState([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isGoogleDriveLoading, setIsGoogleDriveLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false); // State for processing

  const fetchGoogleDriveFiles = useCallback(async (token) => {
    setIsLoadingFiles(true);
    const baseUrl = 'https://www.googleapis.com/drive/v3/files';
    const params = new URLSearchParams();
    params.append(
      'q',
      "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false"
    );
    params.append('orderBy', 'modifiedTime desc');
    params.append('fields', 'files(id, name, modifiedTime, iconLink)');
    const url = `${baseUrl}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.status}`);
      }
      const json = await response.json();
      return json.files || [];
    } catch (error) {
      console.error('Error in fetchGoogleDriveFiles:', error);
      Alert.alert('Lỗi', 'Không thể lấy danh sách file từ Google Drive.');
      throw error;
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  const handleFileSelect = useCallback(async (driveFile, fileName) => {
    setIsPickerVisible(false);
    setIsProcessingFile(true);
    Alert.alert(
      'Đang xử lý...',
      `Hệ thống đang xử lý file "${fileName}". Vui lòng chờ.`
    );

    try {
      // 1. Lấy accessToken từ GoogleSignin
      const tokens = await GoogleSignin.getTokens();
      const { accessToken } = tokens;

      if (!accessToken) {
        throw new Error(
          'Không thể lấy được access token của Google. Vui lòng đăng nhập lại.'
        );
      }

      // 2. Gọi Cloud Function `importMaterialsFromDrive`
      const importMaterials = httpsCallable(
        functions,
        'importMaterialsFromDrive'
      );
      const result = await importMaterials({
        driveFileId: driveFile.id,
        accessToken,
      });

      // 3. Xử lý kết quả trả về
      const { materials: importedMaterials } = result.data;

      if (importedMaterials && importedMaterials.length > 0) {
        setMaterials(importedMaterials);
        setShowMaterialsTable(true);
        Alert.alert(
          'Nhập dữ liệu thành công',
          `Đã nhập ${importedMaterials.length} dòng dữ liệu từ file "${fileName}".`
        );
      } else {
        Alert.alert(
          'Không có dữ liệu',
          `Không tìm thấy dữ liệu vật tư hợp lệ trong file "${fileName}".`
        );
      }
    } catch (error) {
      console.error('Lỗi khi gọi importMaterialsFromDrive:', error);
      let errorMessage = error.message;
      if (error.code === 'functions/unauthenticated') {
        errorMessage =
          'Xác thực thất bại. Vui lòng đăng xuất và đăng nhập lại.';
      } else if (error.code === 'functions/permission-denied') {
        errorMessage =
          'Token truy cập Google Drive đã hết hạn. Vui lòng thử lại.';
      }
      Alert.alert('Lỗi xử lý file', `Chi tiết: ${errorMessage}`);
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  const handleImportFromGoogleDrive = useCallback(async () => {
    setIsGoogleDriveLoading(true);
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        await GoogleSignin.signIn();
      }
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;
      if (!accessToken) {
        throw new Error('Không thể lấy được access token.');
      }
      const files = await fetchGoogleDriveFiles(accessToken);
      if (files && files.length > 0) {
        setDriveFiles(files);
        setIsPickerVisible(true);
      } else {
        Alert.alert(
          'Không tìm thấy file',
          'Không tìm thấy file Excel nào trong Google Drive của bạn.'
        );
      }
    } catch (error) {
      console.error('Lỗi khi thao tác với Google Drive:', error);
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Lỗi', 'Đã xảy ra lỗi khi kết nối với Google Drive.');
      }
    } finally {
      setIsGoogleDriveLoading(false);
    }
  }, [fetchGoogleDriveFiles]);

  const handlePriceChange = useCallback((text, index) => {
    // Sử dụng callback form của setState để đảm bảo truy cập vào state mới nhất
    setMaterials((currentMaterials) => {
      const newMaterials = JSON.parse(JSON.stringify(currentMaterials));
      const item = newMaterials[index];
      const price = parseFloat(text) || 0;
      item.unitPrice = price;
      item.totalPrice = (item.quantity || 0) * (item.weight || 0) * price;
      return newMaterials;
    });
  }, []); // Dependency rỗng vì chúng ta dùng callback form của setState

  const handleRequote = useCallback((quotation) => {
    if (quotation.materials && Array.isArray(quotation.materials)) {
      setMaterials(JSON.parse(JSON.stringify(quotation.materials)));
      setShowMaterialsTable(true);
      Alert.alert(
        'Tải thành công',
        `Đã tải lại dữ liệu từ báo giá ${quotation.quotationNumber}.`
      );
    } else {
      Alert.alert('Lỗi', 'Báo giá này không chứa dữ liệu vật tư để tải lại.');
    }
  }, []);

  return {
    materials,
    showMaterialsTable,
    driveFiles,
    isPickerVisible,
    isLoadingFiles,
    isGoogleDriveLoading,
    isProcessingFile,
    handleImportFromGoogleDrive,
    handleFileSelect,
    handlePriceChange,
    handleRequote,
    setIsPickerVisible,
  };
};
