// src/api/paymentService.js
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Tạo một yêu cầu thanh toán mới
 * @param {Object} data - Dữ liệu yêu cầu thanh toán
 * @param {string} userId - ID của người tạo yêu cầu
 * @returns {Promise<string>} - ID của yêu cầu thanh toán đã tạo
 */
export const createPaymentRequest = async (data, userId) => {
  try {
    const paymentRequestData = {
      ...data,
      totalPaid: 0,
      status: 'pending',
      createdBy: userId,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, 'payment_requests'),
      paymentRequestData
    );
    return docRef.id;
  } catch (error) {
    console.error('Error creating payment request:', error);
    throw error;
  }
};

/**
 * Lấy tất cả yêu cầu thanh toán của một dự án
 * @param {string} projectId - ID của dự án
 * @returns {Promise<Array>} - Mảng yêu cầu thanh toán
 */
export const getPaymentRequestsByProject = async (projectId) => {
  try {
    const q = query(
      collection(db, 'payment_requests'),
      where('projectId', '==', projectId),
      orderBy('issueDate', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting payment requests by project:', error);
    throw error;
  }
};

/**
 * Lấy chi tiết một yêu cầu thanh toán
 * @param {string} requestId - ID của yêu cầu thanh toán
 * @returns {Promise<Object|null>} - Dữ liệu yêu cầu thanh toán hoặc null nếu không tìm thấy
 */
export const getPaymentRequestById = async (requestId) => {
  try {
    const docRef = doc(db, 'payment_requests', requestId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // Get payment history
      const paymentsQuery = query(
        collection(db, 'payment_requests', requestId, 'payments'),
        orderBy('paymentDate', 'desc')
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const payments = paymentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        id: docSnap.id,
        ...docSnap.data(),
        payments,
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting payment request:', error);
    throw error;
  }
};

/**
 * Ghi nhận một khoản thanh toán cho yêu cầu
 * @param {string} requestId - ID của yêu cầu thanh toán
 * @param {Object} paymentData - Dữ liệu thanh toán
 * @returns {Promise<string>} - ID của thanh toán đã tạo
 */
export const logPayment = async (requestId, paymentData) => {
  try {
    const paymentRef = doc(db, 'payment_requests', requestId);
    const paymentDoc = await getDoc(paymentRef);

    if (!paymentDoc.exists()) {
      throw new Error('Không tìm thấy yêu cầu thanh toán');
    }

    return await runTransaction(db, async (transaction) => {
      // Get the current payment request
      const paymentRequest = paymentDoc.data();
      const amount = paymentRequest.amount || 0;
      const currentTotalPaid = paymentRequest.totalPaid || 0;
      const newPaymentAmount = paymentData.amountPaid || 0;

      // Calculate new total paid
      const newTotalPaid = currentTotalPaid + newPaymentAmount;

      // Determine new status
      let newStatus = paymentRequest.status;
      if (newTotalPaid >= amount) {
        newStatus = 'paid';
      } else if (newTotalPaid > 0) {
        newStatus = 'partially_paid';
      } else {
        // Check if payment is overdue
        const dueDate =
          paymentRequest.dueDate?.toDate?.() || paymentRequest.dueDate;
        if (dueDate && new Date() > dueDate) {
          newStatus = 'overdue';
        }
      }

      // Create payment record
      const paymentWithTimestamp = {
        ...paymentData,
        paymentDate: paymentData.paymentDate || serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      // Add to subcollection
      const paymentDocRef = doc(
        collection(db, 'payment_requests', requestId, 'payments')
      );

      transaction.set(paymentDocRef, paymentWithTimestamp);

      // Update the main payment request
      transaction.update(paymentRef, {
        totalPaid: newTotalPaid,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      return paymentDocRef.id;
    });
  } catch (error) {
    console.error('Error logging payment:', error);
    throw error;
  }
};

/**
 * Cập nhật mã số hóa đơn MISA
 * @param {string} requestId - ID của yêu cầu thanh toán
 * @param {string} invoiceNumber - Mã số hóa đơn MISA
 * @returns {Promise<void>}
 */
export const updateMisaInvoiceNumber = async (requestId, invoiceNumber) => {
  try {
    const requestRef = doc(db, 'payment_requests', requestId);

    const updateData = {
      misaInvoiceNumber: invoiceNumber,
      updatedAt: serverTimestamp(),
    };

    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(requestRef, cleanData);
  } catch (error) {
    console.error('Error updating MISA invoice number:', error);
    throw error;
  }
};

const PaymentService = {
  createPaymentRequest,
  getPaymentRequestsByProject,
  getPaymentRequestById,
  logPayment,
  updateMisaInvoiceNumber,
};

export default PaymentService;
