import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// Lấy tất cả chi phí cố định
export const getFixedCosts = async () => {
  try {
    const q = query(
      collection(db, 'fixed_costs'),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const fixedCosts = [];
    querySnapshot.forEach((doc) => {
      fixedCosts.push({ id: doc.id, ...doc.data() });
    });
    return fixedCosts;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách chi phí cố định:', error);
    throw error;
  }
};

// Lấy chi phí cố định theo ID
export const getFixedCostById = async (id) => {
  try {
    const docRef = doc(db, 'fixed_costs', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Lỗi khi lấy chi phí cố định:', error);
    throw error;
  }
};

// Thêm chi phí cố định mới
export const addFixedCost = async (fixedCostData, userId) => {
  try {
    const fixedCostToAdd = {
      ...fixedCostData,
      monthlyCost: Number(fixedCostData.monthlyCost || 0),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    const cleanData = Object.fromEntries(
      Object.entries(fixedCostToAdd).filter(([_, value]) => value !== undefined)
    );
    const docRef = await addDoc(collection(db, 'fixed_costs'), cleanData);
    return docRef.id;
  } catch (error) {
    console.error('Lỗi khi thêm chi phí cố định:', error);
    throw error;
  }
};

// Cập nhật chi phí cố định
export const updateFixedCost = async (id, fixedCostData, userId) => {
  try {
    const fixedCostToUpdate = {
      ...fixedCostData,
      monthlyCost: Number(fixedCostData.monthlyCost || 0),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    const cleanData = Object.fromEntries(
      Object.entries(fixedCostToUpdate).filter(
        ([_, value]) => value !== undefined
      )
    );
    const docRef = doc(db, 'fixed_costs', id);
    await updateDoc(docRef, cleanData);
  } catch (error) {
    console.error('Lỗi khi cập nhật chi phí cố định:', error);
    throw error;
  }
};

// Xóa chi phí cố định
export const deleteFixedCost = async (id) => {
  try {
    const docRef = doc(db, 'fixed_costs', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Lỗi khi xóa chi phí cố định:', error);
    throw error;
  }
};

// Lấy tổng chi phí cố định hàng tháng
export const getTotalMonthlyFixedCosts = async () => {
  try {
    const fixedCosts = await getFixedCosts();
    return fixedCosts.reduce(
      (total, cost) => total + Number(cost.monthlyCost || 0),
      0
    );
  } catch (error) {
    console.error('Lỗi khi tính tổng chi phí cố định:', error);
    throw error;
  }
};















