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

export const useMaterialsProcessor = (project) => {
  // State for materials data and table visibility
  const [materials, setMaterials] = useState([]);
  const [showMaterialsTable, setShowMaterialsTable] = useState(false);

  // State for Google Drive integration
  const [driveFiles, setDriveFiles] = useState([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isGoogleDriveLoading, setIsGoogleDriveLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false); // State for processing

  const fetchGoogleDriveFiles = useCallback(async (token, folderId = null) => {
    setIsLoadingFiles(true);
    const baseUrl = 'https://www.googleapis.com/drive/v3/files';
    const params = new URLSearchParams();

    // Build query: when folderId provided, restrict to it; otherwise no results (we always want a folder)
    let query = 'trashed=false';
    if (folderId) {
      query = `'${folderId}' in parents and mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false`;
    } else {
      // No folder provided → return empty list
      return [];
    }

    params.append('q', query);
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
      const { materials: importedMaterials } = result.data || {};

      if (importedMaterials && importedMaterials.length > 0) {
        // DEBUG: log nguyên liệu gốc
        try {
          console.log(
            'Dữ liệu gốc từ backend:',
            JSON.stringify(importedMaterials, null, 2)
          );
        } catch (_) {}

        // Luôn giữ lại dòng tổng hợp (isSummary)
        const filteredMaterials = importedMaterials.filter(
          (item) =>
            item?.isSummary ||
            !(item?.name && item.name.toUpperCase().includes('LÊ SỸ BÌNH'))
        );

        // DEBUG: log sau khi lọc
        try {
          console.log(
            'Dữ liệu sau khi lọc:',
            JSON.stringify(filteredMaterials, null, 2)
          );
        } catch (_) {}

        // Process materials: filter out unwanted rows and mark special rows
        const processedMaterials = filteredMaterials.map((item) => {
          // 1) Ưu tiên kiểm tra dòng tổng hợp trước tiên
          if (item.isSummary) {
            return {
              ...item,
              // Gán giá trị KL tổng (totalWeight) vào thuộc tính KL (weight)
              // để giao diện hiển thị một cách nhất quán
              weight: item.totalWeight || item.weight || 0,
              selected: false,
              isNote: false,
              isAccessory: false,
            };
          }

          const name = (item.name || '').trim().toUpperCase();

          // 2) Kiểm tra phụ kiện
          const isAccessory = /^(PHỤ KIỆN ĐI KÈM)/.test(name);
          if (isAccessory) {
            return {
              ...item,
              isNote: false,
              isAccessory: true,
              no: '',
              stt: '',
              quantity: '',
              weight: 0,
              unitPrice: 0,
              totalPrice: 0,
              selected: false,
            };
          }

          // 3) Kiểm tra ghi chú
          const isNote =
            /^(GHI CHÚ|\+|-|\*)/.test(name) ||
            (item.name &&
              !item.quantity &&
              !item.unit &&
              !item.material &&
              !item.quyCach);
          if (isNote) {
            return {
              ...item,
              isNote: true,
              no: '',
              stt: '',
              quantity: 0,
              weight: 0,
              unitPrice: 0,
              totalPrice: 0,
              selected: false,
            };
          }

          // 4) Vật tư thông thường: tính thành tiền
          const quantity = parseFloat(item.quantity || 0);
          const weight = parseFloat(item.weight || 0);
          const unitPrice = parseFloat(item.unitPrice || 0);
          const totalPrice =
            weight > 0 ? quantity * weight * unitPrice : quantity * unitPrice;

          return {
            ...item,
            isNote: false,
            isAccessory: false,
            selected: true,
            stt: item.stt || item.no || '',
            no: item.stt || item.no || '',
            totalPrice,
          };
        });

        console.log(`Đã xử lý ${processedMaterials.length} mục sau khi lọc.`);

        // Đặt dữ liệu vào state và hiển thị
        setMaterials(processedMaterials);
        setShowMaterialsTable(true);
        Alert.alert(
          'Nhập dữ liệu thành công',
          `Đã nhập và xử lý ${processedMaterials.length} dòng dữ liệu.`
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

      // Check if we have project info with a Drive folder ID
      if (project && project.driveFolderId) {
        // 1) Find or create the subfolder "Thống kê vật tư" inside the project root
        const listChildrenUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `'${project.driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        )}&fields=files(id,name)&orderBy=name`;

        const listRes = await fetch(listChildrenUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!listRes.ok) {
          throw new Error(`Google Drive API error: ${listRes.status}`);
        }
        const childJson = await listRes.json();
        let statsFolder = (childJson.files || []).find(
          (f) => f.name === 'Thống kê vật tư'
        );

        // Create folder if missing
        if (!statsFolder) {
          const createRes = await fetch(
            'https://www.googleapis.com/drive/v3/files',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: 'Thống kê vật tư',
                mimeType: 'application/vnd.google-apps.folder',
                parents: [project.driveFolderId],
              }),
            }
          );
          if (!createRes.ok) {
            throw new Error(
              `Không thể tạo thư mục 'Thống kê vật tư' (HTTP ${createRes.status})`
            );
          }
          const created = await createRes.json();
          statsFolder = { id: created.id, name: created.name };
        }

        // 2) List latest Excel files from that folder
        const files = await fetchGoogleDriveFiles(accessToken, statsFolder.id);
        if (files && files.length > 0) {
          setDriveFiles(files);
          setIsPickerVisible(true);
        } else {
          Alert.alert(
            'Không tìm thấy file',
            'Không tìm thấy file Excel nào trong thư mục dự án này. Hãy tải file Excel vào thư mục dự án trên Google Drive trước.'
          );
        }
      } else {
        // Fallback to scanning all of Drive if no project folder ID
        Alert.alert(
          'Thông báo',
          'Thư mục Google Drive cho dự án này chưa được thiết lập. Hệ thống sẽ tìm trong toàn bộ Google Drive của bạn.'
        );
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
      }
    } catch (error) {
      console.error('Lỗi khi thao tác với Google Drive:', error);
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Lỗi', 'Đã xảy ra lỗi khi kết nối với Google Drive.');
      }
    } finally {
      setIsGoogleDriveLoading(false);
    }
  }, [fetchGoogleDriveFiles, project]);

  const handlePriceChange = useCallback((text, index) => {
    // Sử dụng callback form của setState để đảm bảo truy cập vào state mới nhất
    setMaterials((currentMaterials) => {
      const newMaterials = JSON.parse(JSON.stringify(currentMaterials));
      const item = newMaterials[index];
      const price = parseFloat(text) || 0;
      item.unitPrice = price;

      // Dòng tổng hợp: thành tiền = đơn giá
      if (item.isSummary) {
        item.totalPrice = price;
        return newMaterials;
      }

      // Calculate total price based on whether weight exists
      const quantity = parseFloat(item.quantity || 0);
      const weight = parseFloat(item.weight || 0);

      if (weight > 0) {
        // If weight exists: totalPrice = quantity * weight * unitPrice
        item.totalPrice = quantity * weight * price;
      } else {
        // If no weight: totalPrice = quantity * unitPrice (for items with unit "bộ")
        item.totalPrice = quantity * price;
      }

      return newMaterials;
    });
  }, []); // Dependency rỗng vì chúng ta dùng callback form của setState

  const handleRequote = useCallback(
    (quotation, navigation, projectId, projectName, project) => {
      // Kiểm tra xem có phải là manual quotation không
      // Chỉ dựa vào các cờ rõ ràng, không suy luận từ dữ liệu
      console.log('Debug quotation data:', {
        id: quotation.id,
        isManualQuotation: quotation.isManualQuotation,
        source: quotation.source,
        materialsCount: quotation.materials?.length,
      });

      const isManualQuotation =
        quotation.isManualQuotation === true || quotation.source === 'manual';

      console.log('Is manual quotation:', isManualQuotation);

      if (isManualQuotation) {
        // Nếu là manual quotation, navigate đến ManualQuotationScreen
        navigation.navigate('ManualQuotation', {
          projectId,
          projectName,
          project,
          existingMaterials: quotation.materials || [],
          isRequote: true,
          originalQuotationId: quotation.id,
        });
      } else {
        // Nếu không phải manual, lấy STT từ báo giá mới nhất và tính toán lại thành tiền
        if (quotation.materials && Array.isArray(quotation.materials)) {
          // Lấy STT từ báo giá mới nhất (có thể là "no", số, chữ cái, etc.)
          // và tính toán lại thành tiền dựa trên đơn giá và số lượng/khối lượng
          const materialsWithLatestSTT = quotation.materials.map((item) => {
            const quantity = parseFloat(item.quantity || 0);
            const weight = parseFloat(item.weight || 0);
            const unitPrice = parseFloat(item.unitPrice || 0);

            // Tính toán lại thành tiền theo logic của QuotationScreen
            const totalPrice = item.isSummary
              ? unitPrice
              : weight > 0
              ? quantity * weight * unitPrice
              : quantity * unitPrice;

            return {
              ...item,
              stt: item.no || item.stt || '', // Lấy STT từ trường 'no' (được lưu trong Firestore) hoặc 'stt'
              totalPrice: totalPrice, // Cập nhật thành tiền đã tính toán
            };
          });

          setMaterials(materialsWithLatestSTT);
          setShowMaterialsTable(true);
          Alert.alert(
            'Tải thành công',
            `Đã tải lại dữ liệu từ báo giá ${quotation.quotationNumber} với STT từ báo giá mới nhất và đã tính toán lại thành tiền.`
          );
        } else {
          Alert.alert(
            'Lỗi',
            'Báo giá này không chứa dữ liệu vật tư để tải lại.'
          );
        }
      }
    },
    []
  );

  // Hàm chỉ lấy STT từ file Excel mới nhất
  const handleGetSTTFromLatestFile = useCallback(
    async (existingMaterials) => {
      try {
        // Sử dụng lại logic import từ Google Drive nhưng chỉ lấy STT
        const tokens = await GoogleSignin.getTokens();
        const { accessToken } = tokens;

        if (!accessToken) {
          throw new Error('Không thể lấy được access token của Google.');
        }

        // Lấy danh sách file Excel từ Google Drive
        const files = await fetchGoogleDriveFiles(accessToken);

        if (files.length === 0) {
          throw new Error('Không tìm thấy file Excel nào.');
        }

        // Lấy file mới nhất
        const latestFile = files[0];

        // Gọi Cloud Function để import file mới nhất
        const importMaterials = httpsCallable(
          functions,
          'importMaterialsFromDrive'
        );
        const result = await importMaterials({
          driveFileId: latestFile.id,
          accessToken,
        });

        if (result.data && result.data.materials) {
          const latestMaterials = result.data.materials;

          // Bắt chước y hệt cách processMaterialData lấy STT và tính toán lại thành tiền
          const updatedMaterials = existingMaterials.map(
            (existingItem, index) => {
              const latestItem = latestMaterials[index];

              // Tính toán lại thành tiền dựa trên đơn giá và số lượng/khối lượng hiện tại
              const quantity = parseFloat(existingItem.quantity || 0);
              const weight = parseFloat(existingItem.weight || 0);
              const unitPrice = parseFloat(existingItem.unitPrice || 0);

              const totalPrice = existingItem.isSummary
                ? unitPrice
                : weight > 0
                ? quantity * weight * unitPrice
                : quantity * unitPrice;

              return {
                ...existingItem, // Giữ nguyên tất cả dữ liệu cũ
                stt: latestItem?.stt || latestItem?.no || '', // Lấy STT từ trường 'stt' hoặc 'no'
                totalPrice: totalPrice, // Cập nhật thành tiền đã tính toán
              };
            }
          );

          setMaterials(updatedMaterials);
          setShowMaterialsTable(true);
          Alert.alert(
            'Thành công',
            'Đã cập nhật STT từ file Excel mới nhất và tính toán lại thành tiền.'
          );
        } else {
          throw new Error('Không thể xử lý dữ liệu từ file Excel.');
        }
      } catch (error) {
        console.error('Error getting STT from latest file:', error);
        // Nếu có lỗi, giữ nguyên dữ liệu cũ
        setMaterials(existingMaterials);
        setShowMaterialsTable(true);
        Alert.alert('Lỗi', 'Không thể cập nhật STT. Giữ nguyên dữ liệu cũ.');
      }
    },
    [fetchGoogleDriveFiles]
  );

  // Process material data from Excel
  const processMaterialData = useCallback((rawData) => {
    if (!rawData || !Array.isArray(rawData)) {
      console.log('No materials data');
      return;
    }

    const processed = rawData.map((item) => {
      // Dòng tổng hợp: KL hiển thị = totalWeight (nếu có), thành tiền = đơn giá
      if (item.isSummary) {
        return {
          ...item,
          weight: item.totalWeight || item.weight || 0,
          totalPrice: parseFloat(item.unitPrice || 0),
          selected: false,
          isNote: false,
        };
      }

      // Check if the item is a note
      if (item.isNote) {
        return {
          ...item,
          selected: false, // Add selected property for consistent handling
        };
      }

      // Extract essential data
      const quantity = parseFloat(item.quantity) || 0;
      const weight = parseFloat(item.weight || 0);
      const unitPrice = parseFloat(item.unitPrice || 0);

      // Calculate total price based on quantity, weight and unit price
      let totalPrice = 0;
      if (weight > 0) {
        totalPrice = quantity * weight * unitPrice;
      } else {
        totalPrice = quantity * unitPrice;
      }

      return {
        stt: item.no || item.stt || '', // Lấy STT từ trường 'no' (được lưu trong Firestore) hoặc 'stt'
        name: item.name || '',
        material: item.material || '',
        quyCach: item.quyCach || '',
        unit: item.unit || '',
        quantity,
        weight,
        unitPrice,
        totalPrice,
        selected: false, // Add selected property
        isNote: false, // Explicitly mark as not a note
      };
    });

    setMaterials(processed);
    setShowMaterialsTable(true);
  }, []);

  return {
    materials,
    setMaterials, // Export setMaterials
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
    handleGetSTTFromLatestFile,
    setIsPickerVisible,
  };
};
