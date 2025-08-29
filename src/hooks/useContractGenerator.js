import { useState } from 'react';
import { Share, Alert, Linking } from 'react-native';
import { httpsCallable, getFunctions } from 'firebase/functions';
import app from '../config/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

/**
 * Custom hook for generating contract documents.
 * This hook now handles generating a Google Doc and sharing its URL.
 * @param {Object} options - Configuration options
 * @returns {Object} - Functions and state for contract generation
 */
const useContractGenerator = ({
  projectId,
  customerData,
  materials,
  quotationData,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [contractDocUrl, setContractDocUrl] = useState(null);

  /**
   * Format contract data for the template.
   */
  const formatContractData = () => {
    // Get today's date components for the contract
    const today = new Date();
    const day = today.getDate().toString();
    const month = (today.getMonth() + 1).toString();

    // Prepare contract data
    const contractData = {
      // Basic info
      companyName: customerData?.companyName || customerData?.name || '',
      customerAddress: customerData?.address || '',
      companyPhone: customerData?.phoneNumber || customerData?.phone || '',
      taxCode: customerData?.taxCode || '',
      day,
      month,
      deliveryTime: quotationData?.deliveryTime || '',

      // Pass the original materials array
      materials: materials || [],
    };

    return contractData;
  };

  /**
   * Generate contract document
   */
  const generateContract = async () => {
    setIsLoading(true);
    setContractDocUrl(null); // Reset on new generation

    try {
      // Ensure Google signed in and get access token
      const signedIn = await GoogleSignin.isSignedIn();
      if (!signedIn) {
        await GoogleSignin.signIn();
      }
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        throw new Error('Không lấy được access token Google.');
      }

      // Format contract data
      const contractData = formatContractData();

      // Call cloud function to generate contract
      const functions = getFunctions(app, 'us-central1');
      const generateContractFunc = httpsCallable(functions, 'generateContract');

      const result = await generateContractFunc({
        contractData,
        fileName: `Hop_dong_${
          customerData?.companyName || customerData?.name || 'khach_hang'
        }_${new Date().getTime()}`,
        projectId,
        accessToken,
      });

      // The cloud function now returns docUrl and docId
      const { docUrl } = result.data;

      // Update state with the new Google Doc URL
      setContractDocUrl(docUrl);

      Alert.alert(
        'Thành công',
        'Đã tạo hợp đồng Google Docs thành công. Bạn có muốn chia sẻ liên kết không?',
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Chia sẻ', onPress: () => shareContractDoc(docUrl) },
        ]
      );

      return { docUrl };
    } catch (error) {
      console.error('Error generating contract:', error);
      Alert.alert(
        'Lỗi',
        `Không thể tạo hợp đồng: ${error.message || 'Lỗi không xác định'}`
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Share the Google Doc contract URL.
   * @param {string} docUrl - The URL of the Google Doc to share.
   */
  const shareContractDoc = async (docUrl) => {
    const urlToShare = docUrl || contractDocUrl;
    if (!urlToShare) {
      Alert.alert('Lỗi', 'Chưa có liên kết hợp đồng để chia sẻ.');
      return;
    }

    try {
      // Trước tiên, thử mở Google Docs trực tiếp để tận dụng giao diện chia sẻ có sẵn của Google
      const canOpenDoc = await Linking.canOpenURL(urlToShare);

      if (canOpenDoc) {
        // Mở trực tiếp Google Doc để người dùng chia sẻ từ giao diện Google
        await Linking.openURL(urlToShare);
        return;
      }

      // Nếu không thể mở trực tiếp, thì thực hiện chia sẻ URL như phương án dự phòng
      await Share.share({
        message: `Vui lòng xem hợp đồng tại đây: ${urlToShare}`,
        url: urlToShare,
        title: 'Chia sẻ Hợp đồng',
      });
    } catch (error) {
      console.error('Error sharing contract doc:', error);
      Alert.alert('Lỗi', 'Không thể chia sẻ hợp đồng: ' + error.message);
    }
  };

  return {
    isLoading,
    contractDocUrl,
    generateContract,
    shareContractDoc,
  };
};

export default useContractGenerator;
