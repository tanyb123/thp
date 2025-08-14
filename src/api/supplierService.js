// src/api/supplierService.js
import { db } from '../config/firebaseConfig';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore';

// Lấy danh sách tất cả nhà cung cấp
export const getAllSuppliers = async () => {
  try {
    const suppliersRef = collection(db, 'suppliers');
    const q = query(suppliersRef, orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhà cung cấp:', error);
    throw error;
  }
};

// Lấy thông tin chi tiết của một nhà cung cấp
export const getSupplierById = async (supplierId) => {
  try {
    const supplierRef = doc(db, 'suppliers', supplierId);
    const supplierDoc = await getDoc(supplierRef);

    if (supplierDoc.exists()) {
      return {
        id: supplierDoc.id,
        ...supplierDoc.data(),
      };
    } else {
      throw new Error('Không tìm thấy nhà cung cấp');
    }
  } catch (error) {
    console.error('Lỗi khi lấy thông tin nhà cung cấp:', error);
    throw error;
  }
};

// Thêm nhà cung cấp mới
export const addSupplier = async (supplierData) => {
  try {
    const suppliersRef = collection(db, 'suppliers');

    // Thêm timestamp
    const supplierWithTimestamp = {
      ...supplierData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(suppliersRef, supplierWithTimestamp);
    return {
      id: docRef.id,
      ...supplierWithTimestamp,
    };
  } catch (error) {
    console.error('Lỗi khi thêm nhà cung cấp:', error);
    throw error;
  }
};

// Cập nhật thông tin nhà cung cấp
export const updateSupplier = async (supplierId, supplierData) => {
  try {
    const supplierRef = doc(db, 'suppliers', supplierId);

    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(supplierData).filter(([_, value]) => value !== undefined)
    );

    // Thêm timestamp cập nhật
    const updatedData = {
      ...cleanData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(supplierRef, updatedData);
    return {
      id: supplierId,
      ...updatedData,
    };
  } catch (error) {
    console.error('Lỗi khi cập nhật nhà cung cấp:', error);
    throw error;
  }
};

// Xóa nhà cung cấp
export const deleteSupplier = async (supplierId) => {
  try {
    const supplierRef = doc(db, 'suppliers', supplierId);
    await deleteDoc(supplierRef);
    return true;
  } catch (error) {
    console.error('Lỗi khi xóa nhà cung cấp:', error);
    throw error;
  }
};

// Tìm kiếm nhà cung cấp theo tên
export const searchSuppliers = async (searchTerm) => {
  try {
    // Lưu ý: Firestore không hỗ trợ tìm kiếm full-text
    // Đây là cách đơn giản để tìm kiếm, có thể cần cải tiến sau
    const suppliersRef = collection(db, 'suppliers');
    const q = query(suppliersRef, orderBy('name'));
    const querySnapshot = await getDocs(q);

    const searchTermLower = searchTerm.toLowerCase();
    return querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (supplier) =>
          supplier.name.toLowerCase().includes(searchTermLower) ||
          (supplier.contactName &&
            supplier.contactName.toLowerCase().includes(searchTermLower)) ||
          (supplier.phone && supplier.phone.includes(searchTerm))
      );
  } catch (error) {
    console.error('Lỗi khi tìm kiếm nhà cung cấp:', error);
    throw error;
  }
};

// Lấy danh sách nhà cung cấp theo danh mục vật tư
export const getSuppliersByCategory = async (category) => {
  try {
    const suppliersRef = collection(db, 'suppliers');
    const q = query(
      suppliersRef,
      where('categories', 'array-contains', category)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Lỗi khi lấy nhà cung cấp theo danh mục:', error);
    throw error;
  }
};

// Thêm đánh giá cho nhà cung cấp
export const addSupplierRating = async (supplierId, ratingData) => {
  try {
    const supplierRef = doc(db, 'suppliers', supplierId);
    const supplierDoc = await getDoc(supplierRef);

    if (!supplierDoc.exists()) {
      throw new Error('Không tìm thấy nhà cung cấp');
    }

    const supplierData = supplierDoc.data();
    const ratings = supplierData.ratings || [];

    // Thêm đánh giá mới với timestamp
    const newRating = {
      ...ratingData,
      createdAt: serverTimestamp(),
    };

    ratings.push(newRating);

    // Tính lại điểm đánh giá trung bình
    const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / ratings.length;

    await updateDoc(supplierRef, {
      ratings,
      averageRating,
      updatedAt: serverTimestamp(),
    });

    return {
      ratings,
      averageRating,
    };
  } catch (error) {
    console.error('Lỗi khi thêm đánh giá nhà cung cấp:', error);
    throw error;
  }
};
