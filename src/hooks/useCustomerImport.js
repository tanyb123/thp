import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { functions } from '../config/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

export const useCustomerImport = () => {
  // State for Google Drive integration
  const [driveFiles, setDriveFiles] = useState([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Lấy danh sách file customer từ Google Drive
  const fetchCustomerFiles = useCallback(async () => {
    setIsLoadingFiles(true);

    try {
      // 1. Kiểm tra đăng nhập Google
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        Alert.alert(
          'Yêu cầu đăng nhập',
          'Vui lòng đăng nhập Google để truy cập file Excel.',
          [
            {
              text: 'Hủy',
              style: 'cancel',
            },
            {
              text: 'Đăng nhập',
              onPress: async () => {
                try {
                  await GoogleSignin.signIn();
                  // Thử lại sau khi đăng nhập
                  fetchCustomerFiles();
                } catch (error) {
                  console.error('Lỗi đăng nhập Google:', error);
                  Alert.alert('Lỗi', 'Không thể đăng nhập Google.');
                }
              },
            },
          ]
        );
        return;
      }

      // 2. Lấy accessToken
      const tokens = await GoogleSignin.getTokens();
      const { accessToken } = tokens;

      if (!accessToken) {
        throw new Error(
          'Không thể lấy được access token của Google. Vui lòng đăng nhập lại.'
        );
      }

      // 3. Gọi Cloud Function để lấy danh sách file
      const getCustomerFilesFunction = httpsCallable(
        functions,
        'getCustomerFiles'
      );
      const result = await getCustomerFilesFunction({ accessToken });

      if (result.data.success) {
        setDriveFiles(result.data.files || []);
      } else {
        throw new Error('Không thể lấy danh sách file');
      }
    } catch (error) {
      console.error('❌ Lỗi khi tải file customer:', error);

      // Xử lý lỗi đăng nhập
      if (error.code === statusCodes.SIGN_IN_REQUIRED) {
        Alert.alert(
          'Yêu cầu đăng nhập',
          'Vui lòng đăng nhập Google để truy cập file Excel.',
          [
            {
              text: 'Hủy',
              style: 'cancel',
            },
            {
              text: 'Đăng nhập',
              onPress: async () => {
                try {
                  await GoogleSignin.signIn();
                  // Thử lại sau khi đăng nhập
                  fetchCustomerFiles();
                } catch (signInError) {
                  console.error('Lỗi đăng nhập Google:', signInError);
                  Alert.alert('Lỗi', 'Không thể đăng nhập Google.');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Lỗi', 'Không thể tải danh sách file customer.');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  // Import khách hàng từ file Excel
  const importCustomersFromFile = useCallback(async (fileId, fileName) => {
    setIsProcessingFile(true);

    try {
      // 1. Kiểm tra đăng nhập Google
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        Alert.alert(
          'Yêu cầu đăng nhập',
          'Vui lòng đăng nhập Google để import file Excel.',
          [
            {
              text: 'Hủy',
              style: 'cancel',
            },
            {
              text: 'Đăng nhập',
              onPress: async () => {
                try {
                  await GoogleSignin.signIn();
                  // Thử lại sau khi đăng nhập
                  importCustomersFromFile(fileId, fileName);
                } catch (error) {
                  console.error('Lỗi đăng nhập Google:', error);
                  Alert.alert('Lỗi', 'Không thể đăng nhập Google.');
                }
              },
            },
          ]
        );
        return;
      }

      // 2. Lấy accessToken
      const tokens = await GoogleSignin.getTokens();
      const { accessToken } = tokens;

      if (!accessToken) {
        throw new Error(
          'Không thể lấy được access token của Google. Vui lòng đăng nhập lại.'
        );
      }

      // 3. Hiển thị thông báo đang xử lý
      Alert.alert(
        'Đang xử lý...',
        `Hệ thống đang import khách hàng từ file "${fileName}". Vui lòng chờ.`
      );

      // 4. Gọi Cloud Function để import
      const importCustomersFunction = httpsCallable(
        functions,
        'importCustomersFromExcel'
      );
      const result = await importCustomersFunction({
        driveFileId: fileId,
        accessToken,
      });

      // 5. Xử lý kết quả
      if (result.data.success) {
        Alert.alert(
          'Thành công',
          `Đã import thành công ${result.data.successCount}/${
            result.data.totalProcessed
          } khách hàng.\n\n${
            result.data.errorCount > 0
              ? `Có ${result.data.errorCount} lỗi.`
              : ''
          }`
        );
        return result.data;
      } else {
        throw new Error('Import không thành công');
      }
    } catch (error) {
      console.error('❌ Lỗi khi import khách hàng:', error);

      // Xử lý lỗi đăng nhập
      if (error.code === statusCodes.SIGN_IN_REQUIRED) {
        Alert.alert(
          'Yêu cầu đăng nhập',
          'Vui lòng đăng nhập Google để import file Excel.',
          [
            {
              text: 'Hủy',
              style: 'cancel',
            },
            {
              text: 'Đăng nhập',
              onPress: async () => {
                try {
                  await GoogleSignin.signIn();
                  // Thử lại sau khi đăng nhập
                  importCustomersFromFile(fileId, fileName);
                } catch (signInError) {
                  console.error('Lỗi đăng nhập Google:', signInError);
                  Alert.alert('Lỗi', 'Không thể đăng nhập Google.');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Lỗi', 'Không thể import khách hàng từ file Excel.');
      }
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  return {
    driveFiles,
    isPickerVisible,
    isLoadingFiles,
    isProcessingFile,
    setIsPickerVisible,
    fetchCustomerFiles,
    importCustomersFromFile,
  };
};















