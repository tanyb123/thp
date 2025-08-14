// src/api/userService.js
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
 * Lấy tất cả người dùng
 * @returns {Promise<Array>} - Mảng người dùng
 */
export const getUsers = async () => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const users = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return users;
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

/**
 * Lấy người dùng theo ID
 * @param {string} userId - ID người dùng
 * @returns {Promise<Object|null>} - Dữ liệu người dùng hoặc null nếu không tìm thấy
 */
export const getUserById = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      return {
        id: userSnapshot.id,
        ...userSnapshot.data(),
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
};

/**
 * Lấy người dùng theo role
 * @param {string} role - Role của người dùng (worker, manager, admin, etc.)
 * @returns {Promise<Array>} - Mảng người dùng thuộc role đã chỉ định
 */
export const getUsersByRole = async (role) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', '==', role),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting users by role:', error);
    throw error;
  }
};

/**
 * Tạo người dùng mới
 * @param {Object} userData - Dữ liệu người dùng
 * @returns {Promise<string>} - ID của người dùng đã tạo
 */
export const createUser = async (userData) => {
  try {
    const docRef = await addDoc(collection(db, 'users'), {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Cập nhật thông tin người dùng
 * @param {string} userId - ID người dùng
 * @param {Object} userData - Dữ liệu người dùng cập nhật
 * @returns {Promise<void>}
 */
export const updateUser = async (userId, userData) => {
  try {
    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(userData).filter(([_, value]) => value !== undefined)
    );

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...cleanData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Xóa người dùng
 * @param {string} userId - ID người dùng
 * @returns {Promise<void>}
 */
export const deleteUser = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Lấy danh sách workers (người làm việc)
 * @returns {Promise<Array>} - Mảng workers
 */
export const getWorkers = async () => {
  try {
    return await getUsersByRole('worker');
  } catch (error) {
    console.error('Error getting workers:', error);
    throw error;
  }
};

/**
 * Tìm kiếm người dùng theo tên
 * @param {string} searchTerm - Từ khóa tìm kiếm
 * @returns {Promise<Array>} - Mảng người dùng phù hợp
 */
export const searchUsers = async (searchTerm) => {
  try {
    const usersRef = collection(db, 'users');
    const nameQuery = query(
      usersRef,
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff')
    );

    const querySnapshot = await getDocs(nameQuery);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

export default {
  getUsers,
  getUserById,
  getUsersByRole,
  createUser,
  updateUser,
  deleteUser,
  getWorkers,
  searchUsers,
};
