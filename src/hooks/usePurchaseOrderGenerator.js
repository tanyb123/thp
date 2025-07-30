// src/hooks/usePurchaseOrderGenerator.js
import { useState, useContext } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { Alert, Linking } from 'react-native';
import AuthContext from '../contexts/AuthContext';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const usePurchaseOrderGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { currentUser } = useContext(AuthContext);

  /**
   * Generate a Purchase Order Excel file for a project
   *
   * @param {Object} poData - The purchase order data
   * @param {string} projectId - The ID of the project
   * @returns {Promise<Object>} - The response object with file URL
   */
  const generatePurchaseOrder = async (poData, projectId) => {
    setLoading(true);
    setError(null);

    try {
      // Ensure Google user is signed in and get accessToken
      const signedIn = await GoogleSignin.isSignedIn();
      if (!signedIn) {
        console.log('Google user not signed in, attempting to sign in...');
        await GoogleSignin.signIn();
      }

      console.log('Getting Google access token...');
      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) {
        throw new Error('Could not get Google access token.');
      }
      console.log('Access token obtained successfully');

      const formattedData = formatPOData(poData);
      console.log('Formatted PO data:', JSON.stringify(formattedData));

      const functions = getFunctions(undefined, 'asia-southeast1');
      const generateExcelPurchaseOrder = httpsCallable(
        functions,
        'generateExcelPurchaseOrder'
      );

      console.log('Calling Firebase function with projectId:', projectId);
      const result = await generateExcelPurchaseOrder({
        formattedData,
        projectId,
        accessToken, // Pass the Google OAuth token
      });

      console.log('Firebase function result:', JSON.stringify(result.data));

      if (result.data && result.data.success) {
        if (result.data.fileUrl) {
          await Linking.openURL(result.data.fileUrl);
        }
        setLoading(false);
        return result.data;
      } else {
        throw new Error(
          result.data?.message || 'Failed to generate Purchase Order'
        );
      }
    } catch (err) {
      console.error('Purchase Order generation error:', err);
      let errorMessage = 'Không thể tạo đơn đặt hàng.';

      if (err.message?.includes('unauthenticated')) {
        errorMessage =
          'Lỗi xác thực Google. Vui lòng đăng nhập lại và thử lại.';
        // Try to reset Google Sign-In
        try {
          await GoogleSignin.signOut();
          console.log('Google sign-out complete, user should re-authenticate');
        } catch (signOutErr) {
          console.error('Error signing out from Google:', signOutErr);
        }
      }

      setError(errorMessage);
      Alert.alert('Lỗi', errorMessage);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Format the data for the PO generator
   *
   * @param {Object} data - The raw data to format
   * @returns {Object} - The formatted data
   */
  const formatPOData = (data) => {
    // Calculate the totals
    const subTotal = calculateSubTotal(data.materials);
    const vatPercentage = data.vatPercentage || 10;
    const vatAmount = (subTotal * vatPercentage) / 100;
    const grandTotal = subTotal + vatAmount;

    return {
      metadata: {
        projectName: data.projectName,
        supplierName: data.supplierName,
        supplierAddress: data.supplierAddress,
        supplierPhone: data.supplierPhone,
        supplierEmail: data.supplierEmail,
        supplierTaxCode: data.supplierTaxCode,
        supplierContactPerson: data.supplierContactPerson,
        poNumber: data.poNumber || `PO-${Date.now().toString().substr(-6)}`,
        poDate: data.poDate || new Date().toLocaleDateString('vi-VN'),
        deliveryTime: data.deliveryTime,
        paymentTerms: data.paymentTerms,
      },
      materials: data.materials.map((item, index) => ({
        ...item,
        no: index + 1,
        name: item.name || '',
        unit: item.unit || '',
        quantity: parseFloat(item.quantity) || 0,
        unitPrice: parseFloat(item.unitPrice) || 0,
        total:
          (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
      })),
      summary: {
        subTotal,
        vatPercentage,
        vatAmount,
        grandTotal,
      },
    };
  };

  /**
   * Calculate the subtotal of all materials
   *
   * @param {Array} materials - List of material items
   * @returns {number} - The calculated subtotal
   */
  const calculateSubTotal = (materials) => {
    return materials.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + quantity * unitPrice;
    }, 0);
  };

  return {
    generatePurchaseOrder,
    loading,
    error,
  };
};

export default usePurchaseOrderGenerator;
