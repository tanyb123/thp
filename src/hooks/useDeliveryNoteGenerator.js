import { useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions as firebaseFunctions } from '../config/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  collection,
  query,
  orderBy,
  getDocs,
  limit,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const useDeliveryNoteGenerator = ({ projectId }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [excelUrl, setExcelUrl] = useState(null);
  const [driveFileId, setDriveFileId] = useState(null);
  const [latestQuotation, setLatestQuotation] = useState(null);
  const [isLoadingQuotation, setIsLoadingQuotation] = useState(false);

  // Fetch the latest quotation for this project
  useEffect(() => {
    const fetchLatestQuotation = async () => {
      if (!projectId) return;

      try {
        setIsLoadingQuotation(true);
        const quotationsRef = collection(
          db,
          `projects/${projectId}/quotations`
        );
        const q = query(quotationsRef, orderBy('createdAt', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const latestQuotationData = {
            id: querySnapshot.docs[0].id,
            ...querySnapshot.docs[0].data(),
          };
          setLatestQuotation(latestQuotationData);
          console.log(
            'Latest quotation found:',
            latestQuotationData.quotationNumber
          );
        } else {
          console.log('No quotations found for this project');
        }
      } catch (error) {
        console.error('Error fetching latest quotation:', error);
      } finally {
        setIsLoadingQuotation(false);
      }
    };

    fetchLatestQuotation();
  }, [projectId]);

  const formatDeliveryNoteDataForExcel = (deliveryNoteData) => {
    const {
      deliveryNoteNumber,
      deliveryDate,
      customerName,
      customerTaxCode,
      customerAddress,
      customerRepresentative,
      customerRepresentativePosition,
      items = [],
    } = deliveryNoteData;

    return {
      metadata: {
        deliveryNoteNumber,
        deliveryDate: new Date(deliveryDate).toLocaleDateString('vi-VN'),
        customerName: customerName || '',
        customerTaxCode: customerTaxCode || '',
        customerAddress: customerAddress || '',
        customerRepresentative: customerRepresentative || '',
        customerRepresentativePosition: customerRepresentativePosition || '',
      },
      items: items.map((item, index) => ({
        no: index + 1,
        name: item.name || '',
        material: item.material || '',
        unit: item.unit || '',
        quantity: item.quantity || 0,
      })),
    };
  };

  // Save delivery note metadata to Firestore
  const saveDeliveryNote = async (deliveryNoteData, excelUrl, driveFileId) => {
    try {
      const deliveryNotesRef = collection(
        db,
        `projects/${projectId}/deliveryNotes`
      );

      await addDoc(deliveryNotesRef, {
        ...deliveryNoteData,
        excelUrl,
        driveFileId,
        createdAt: serverTimestamp(),
      });

      console.log('Delivery note saved to Firestore');
    } catch (error) {
      console.error('Error saving delivery note to Firestore:', error);
      // Continue even if saving to Firestore fails
    }
  };

  const generateDeliveryNote = async (deliveryNoteData) => {
    try {
      setIsLoading(true);
      const formattedData = formatDeliveryNoteDataForExcel(deliveryNoteData);

      // Ensure we have a Google access token
      const signedIn = await GoogleSignin.isSignedIn();
      if (!signedIn) {
        await GoogleSignin.signIn();
      }
      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) {
        throw new Error('Không thể lấy Google access token');
      }

      console.log(
        'Calling generateDeliveryNoteExcel with accessToken:',
        accessToken ? 'Valid token' : 'No token'
      );

      const generateExcelFunc = httpsCallable(
        firebaseFunctions,
        'generateDeliveryNoteExcel'
      );

      console.log('Sending data to cloud function:', {
        projectId,
        deliveryNoteId: deliveryNoteData.deliveryNoteNumber.replace(/\//g, '-'),
      });

      const result = await generateExcelFunc({
        formattedData,
        projectId,
        deliveryNoteId: deliveryNoteData.deliveryNoteNumber.replace(/\//g, '-'),
        accessToken,
      });

      console.log('Cloud function result:', result.data);
      const { excelUrl: url, driveFileId: fileId } = result.data;

      setExcelUrl(url);
      setDriveFileId(fileId);

      // Save to Firestore
      await saveDeliveryNote(deliveryNoteData, url, fileId);

      return url;
    } catch (error) {
      console.error('Error generating delivery note excel:', error);
      Alert.alert('Lỗi', 'Không thể tạo biên bản giao hàng: ' + error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const shareDeliveryNote = async () => {
    try {
      if (!excelUrl) {
        Alert.alert('Lỗi', 'Chưa có file biên bản để chia sẻ.');
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}delivery_note.xlsx`;
      const { uri } = await FileSystem.downloadAsync(excelUrl, fileUri);

      await Sharing.shareAsync(uri, {
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Chia sẻ biên bản giao hàng',
      });
    } catch (error) {
      console.error('Error sharing delivery note:', error);
      Alert.alert('Lỗi', 'Không thể chia sẻ file: ' + error.message);
    }
  };

  return {
    generateDeliveryNote,
    shareDeliveryNote,
    isLoading,
    isLoadingQuotation,
    excelUrl,
    driveFileId,
    latestQuotation,
  };
};

export default useDeliveryNoteGenerator;
