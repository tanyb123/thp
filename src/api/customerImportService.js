import { getFunctions, httpsCallable } from 'firebase/functions';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const functions = getFunctions();

// Lấy danh sách file customer từ Google Drive
export const getCustomerFiles = async () => {
  try {
    // 1. Lấy accessToken từ GoogleSignin
    const tokens = await GoogleSignin.getTokens();
    const { accessToken } = tokens;

    if (!accessToken) {
      throw new Error(
        'Không thể lấy được access token của Google. Vui lòng đăng nhập lại.'
      );
    }

    // 2. Gọi Cloud Function với accessToken
    const getCustomerFilesFunction = httpsCallable(
      functions,
      'getCustomerFiles'
    );
    const result = await getCustomerFilesFunction({ accessToken });

    console.log('📁 Danh sách file customer:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách file customer:', error);
    throw error;
  }
};

// Import khách hàng từ Excel file
export const importCustomersFromExcel = async (fileId) => {
  try {
    console.log('🚀 Bắt đầu import khách hàng từ file:', fileId);

    // 1. Lấy accessToken từ GoogleSignin
    const tokens = await GoogleSignin.getTokens();
    const { accessToken } = tokens;

    if (!accessToken) {
      throw new Error(
        'Không thể lấy được access token của Google. Vui lòng đăng nhập lại.'
      );
    }

    // 2. Gọi Cloud Function với accessToken
    const importCustomersFunction = httpsCallable(
      functions,
      'importCustomersFromExcel'
    );
    const result = await importCustomersFunction({
      driveFileId: fileId,
      accessToken,
    });

    console.log('✅ Kết quả import khách hàng:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Lỗi khi import khách hàng:', error);
    throw error;
  }
};
