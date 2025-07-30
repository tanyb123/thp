import { useState } from 'react';
import { Alert } from 'react-native';
import { savePOReceiptConfirmation } from '../api/purchaseOrderService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import uuid from 'react-native-uuid';

const usePOReceipt = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Upload a single file to Drive
  const uploadFile = async (projectId, file) => {
    try {
      console.log(
        `[POReceipt] Starting upload for file: ${file.fileName || 'unnamed'}`
      );

      // Lấy accessToken Google của người dùng
      console.log('[POReceipt] Getting Google access token');
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      if (!accessToken) {
        console.error('[POReceipt] No access token available');
        throw new Error(
          'Phiên đăng nhập Google đã hết. Vui lòng đăng nhập lại.'
        );
      }
      console.log('[POReceipt] Got access token successfully');

      // Generate a unique filename
      const ext = (file.fileName || 'jpg').split('.').pop();
      const uniqueFileName = `PO_${uuid.v4()}.${ext}`;
      console.log(`[POReceipt] Generated filename: ${uniqueFileName}`);

      // Call the uploadFileToDrive Cloud Function
      console.log('[POReceipt] Calling uploadFileToDriveUser cloud function');
      const uploadFn = httpsCallable(functions, 'uploadFileToDriveUser');
      const result = await uploadFn({
        accessToken,
        projectId,
        fileName: uniqueFileName,
        mimeType: file.mimeType,
        base64Data: file.base64Data,
      });

      console.log(
        '[POReceipt] Cloud function response:',
        JSON.stringify(result.data)
      );

      if (!result.data.success) {
        console.error('[POReceipt] Upload failed:', result.data.message);
        throw new Error(result.data.message || 'Lỗi tải file lên server');
      }

      console.log(
        `[POReceipt] File uploaded successfully. FileID: ${result.data.fileId}, Link: ${result.data.webViewLink}`
      );
      return result.data;
    } catch (err) {
      console.error('[POReceipt] File upload error:', err);
      // Log detailed error information
      if (err.details) {
        console.error(
          '[POReceipt] Error details:',
          JSON.stringify(err.details)
        );
      }
      if (err.code) {
        console.error('[POReceipt] Error code:', err.code);
      }
      console.error('File upload error in hook:', err);
      // Ném lỗi ra ngoài để hàm confirmReceipt có thể bắt được
      throw err;
    }
  };

  // Main function to handle the entire PO receipt confirmation process
  const confirmReceipt = async ({ poId, projectId, files, remarks }) => {
    setLoading(true);
    setError(null);
    setUploadProgress(0);

    try {
      console.log(
        `[POReceipt] Starting confirmation process for PO: ${poId}, Project: ${projectId}`
      );
      console.log(`[POReceipt] Files to upload: ${files.length}`);

      // Step 1: Upload each file one by one
      const totalFiles = files.length;
      const uploadedFilesInfo = [];

      for (let i = 0; i < totalFiles; i++) {
        const fileToUpload = files[i];
        console.log(
          `Uploading file ${i + 1}/${totalFiles}:`,
          fileToUpload.fileName
        );
        const uploadResult = await uploadFile(projectId, fileToUpload);

        uploadedFilesInfo.push({
          id: uploadResult.fileId,
          name: uploadResult.fileName || fileToUpload.fileName,
          url: uploadResult.webViewLink,
          mimeType: uploadResult.mimeType,
          preview: uploadResult.thumbnailLink,
        });

        // Update progress
        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      // Step 2: Save the PO receipt confirmation data to Firestore
      console.log('All files uploaded. Saving confirmation to Firestore...');
      console.log(`[POReceipt] Files uploaded: ${uploadedFilesInfo.length}`);
      console.log(
        `[POReceipt] File details:`,
        JSON.stringify(uploadedFilesInfo)
      );

      const result = await savePOReceiptConfirmation({
        poId,
        projectId,
        filesToSave: uploadedFilesInfo,
        remarks,
      });

      console.log(`[POReceipt] PO receipt confirmation saved successfully`);
      console.log(`[POReceipt] Result:`, result);

      setLoading(false);
      setUploadProgress(0);
      return result;
    } catch (err) {
      console.error('Confirm receipt process failed:', err);
      console.error('[POReceipt] Error stack:', err.stack);
      const errorMessage =
        err.details?.message || err.message || 'Không thể xác nhận PO.';
      setError(errorMessage);
      Alert.alert('Lỗi', errorMessage);
      setLoading(false);
      setUploadProgress(0);
      // Không cần throw err nữa vì đã xử lý ở đây
    }
  };

  return { confirmReceipt, loading, error, uploadProgress };
};

export default usePOReceipt;
