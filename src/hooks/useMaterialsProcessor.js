//src/hooks/useMaterialsProcessor.js
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as XLSX from 'xlsx';

export const useMaterialsProcessor = () => {
  // State for materials data and table visibility
  const [materials, setMaterials] = useState([]);
  const [showMaterialsTable, setShowMaterialsTable] = useState(false);

  // State for Google Drive integration
  const [driveFiles, setDriveFiles] = useState([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isGoogleDriveLoading, setIsGoogleDriveLoading] = useState(false);

  // Hàm lấy danh sách file Excel từ Google Drive
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

  // Hàm xử lý và hiển thị dữ liệu từ file Excel
  const parseAndDisplayData = useCallback((base64Data, fileName) => {
    try {
      const workbook = XLSX.read(base64Data, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const parsedMaterials = [];
      for (let i = 4; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !row[1] || typeof row[8] !== 'number') {
          continue;
        }
        const materialItem = {
          stt: row[0],
          name: row[1] || '',
          material: row[2] || '',
          quyCach: row[3] && row[4] ? `${row[3]}x${row[4]}` : '',
          unit: row[6] || '',
          quantity: parseFloat(row[7]) || 0,
          weight: parseFloat(row[8]) || 0,
          unitPrice: 0,
          totalPrice: 0,
        };
        parsedMaterials.push(materialItem);
      }
      setMaterials(parsedMaterials);
      setShowMaterialsTable(true);
      Alert.alert(
        'Nhập dữ liệu thành công',
        `Đã nhập ${parsedMaterials.length} dòng dữ liệu từ file "${fileName}".`
      );
    } catch (error) {
      console.error('Error processing Excel data:', error);
      Alert.alert('Lỗi', 'Không thể xử lý dữ liệu Excel.');
    }
  }, []);

  // Hàm xử lý khi người dùng chọn một file
  const handleFileSelect = useCallback(
    async (fileId, fileName) => {
      try {
        Alert.alert('Đang tải xuống', `Đang tải file "${fileName}"...`);
        const tokens = await GoogleSignin.getTokens();
        const freshAccessToken = tokens.accessToken;
        if (!freshAccessToken) {
          Alert.alert('Lỗi', 'Phiên đăng nhập đã hết hạn.');
          return;
        }
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${freshAccessToken}` } }
        );
        if (!response.ok) {
          throw new Error(`Download error: ${response.status}`);
        }
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          parseAndDisplayData(base64, fileName);
          setIsPickerVisible(false);
        };
        reader.onerror = () => {
          Alert.alert('Lỗi', 'Không thể đọc file.');
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Error downloading file:', error);
        Alert.alert('Lỗi', 'Không thể tải xuống file từ Google Drive.');
      }
    },
    [parseAndDisplayData]
  );

  // Hàm xử lý khi nhấn nút import
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

  // Hàm xử lý khi người dùng nhập đơn giá
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

  // Hàm xử lý khi báo giá lại
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
    handleImportFromGoogleDrive,
    handleFileSelect,
    handlePriceChange,
    handleRequote,
    setIsPickerVisible,
  };
};
