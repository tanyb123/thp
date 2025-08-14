//src/api/customerService.js
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDocs,
  getDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Tạo khách hàng mới
 * @param {Object} customerData - Dữ liệu khách hàng
 * @param {string} userId - ID của người dùng tạo khách hàng
 * @returns {Promise<Object>} - Khách hàng đã tạo kèm ID
 */
export const createCustomer = async (customerData, userId) => {
  try {
    const docRef = await addDoc(collection(db, 'customers'), {
      ...customerData,
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
    });

    return {
      id: docRef.id,
      ...customerData,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Lấy tất cả khách hàng
 * @returns {Promise<Array>} - Mảng khách hàng
 */
export const getCustomers = async () => {
  try {
    const customersRef = collection(db, 'customers');
    const q = query(customersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw error;
  }
};

/**
 * Lấy khách hàng theo ID
 * @param {string} customerId - ID khách hàng
 * @returns {Promise<Object|null>} - Dữ liệu khách hàng hoặc null nếu không tìm thấy
 */
export const getCustomerById = async (customerId) => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    const customerSnapshot = await getDoc(customerRef);

    if (customerSnapshot.exists()) {
      return {
        id: customerSnapshot.id,
        ...customerSnapshot.data(),
      };
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Cập nhật thông tin khách hàng
 * @param {string} customerId - ID khách hàng
 * @param {Object} customerData - Dữ liệu khách hàng cập nhật
 * @param {string} userId - ID của người dùng cập nhật khách hàng
 * @returns {Promise<void>}
 */
export const updateCustomer = async (customerId, customerData, userId) => {
  try {
    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(customerData).filter(([_, value]) => value !== undefined)
    );

    const customerRef = doc(db, 'customers', customerId);
    await updateDoc(customerRef, {
      ...cleanData,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật khách hàng:', error);
    throw error;
  }
};

/**
 * Xóa khách hàng
 * @param {string} customerId - ID khách hàng
 * @returns {Promise<void>}
 */
export const deleteCustomer = async (customerId) => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    await deleteDoc(customerRef);
  } catch (error) {
    throw error;
  }
};

/**
 * Tìm kiếm khách hàng theo tên hoặc người liên hệ
 * @param {string} searchTerm - Từ khóa tìm kiếm
 * @returns {Promise<Array>} - Mảng khách hàng phù hợp
 */
export const searchCustomers = async (searchTerm) => {
  try {
    const customersRef = collection(db, 'customers');
    const nameQuery = query(
      customersRef,
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff')
    );
    const contactQuery = query(
      customersRef,
      where('contactPerson', '>=', searchTerm),
      where('contactPerson', '<=', searchTerm + '\uf8ff')
    );

    const [nameSnapshot, contactSnapshot] = await Promise.all([
      getDocs(nameQuery),
      getDocs(contactQuery),
    ]);

    // Kết hợp kết quả và loại bỏ trùng lặp
    const results = new Map();

    nameSnapshot.docs.forEach((doc) => {
      results.set(doc.id, { id: doc.id, ...doc.data() });
    });

    contactSnapshot.docs.forEach((doc) => {
      if (!results.has(doc.id)) {
        results.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });

    return Array.from(results.values());
  } catch (error) {
    throw error;
  }
};

/**
 * Lấy khách hàng theo loại
 * @param {string} type - Loại khách hàng (potential, regular, vip)
 * @returns {Promise<Array>} - Mảng khách hàng thuộc loại đã chỉ định
 */
export const getCustomersByType = async (type) => {
  try {
    const customersRef = collection(db, 'customers');
    const q = query(
      customersRef,
      where('type', '==', type),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw error;
  }
};
