import { db } from '../config/firebaseConfig';
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

// Lưu chi phí dự án
export const saveProjectExpense = async (projectId, expenseData) => {
  try {
    const expenseRef = await addDoc(collection(db, 'expenses'), {
      projectId,
      projectName: expenseData.projectName,
      materialCost: expenseData.materialCost || 0,
      laborCost: expenseData.laborCost || 0,
      accessoryCost: expenseData.accessoryCost || 0,
      totalCost: expenseData.totalCost || 0,
      materialBreakdown: expenseData.materialBreakdown || {},
      laborBreakdown: expenseData.laborBreakdown || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Đã lưu chi phí dự án:', projectId, expenseRef.id);
    return expenseRef.id;
  } catch (error) {
    console.error('❌ Lỗi khi lưu chi phí dự án:', error);
    throw error;
  }
};

// Lấy chi phí dự án
export const getProjectExpense = async (projectId) => {
  try {
    const q = query(
      collection(db, 'expenses'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log('⚠️ Không tìm thấy chi phí cho dự án:', projectId);
      return null;
    }

    const expense = querySnapshot.docs[0].data();
    console.log('📋 Chi phí dự án:', projectId, expense);
    return { id: querySnapshot.docs[0].id, ...expense };
  } catch (error) {
    console.error('❌ Lỗi khi lấy chi phí dự án:', error);
    throw error;
  }
};

// Tạo hoặc cập nhật chi phí theo projectId
export const upsertProjectExpense = async (projectId, expenseData) => {
  try {
    const q = query(
      collection(db, 'expenses'),
      where('projectId', '==', projectId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docId = snap.docs[0].id;
      await updateDoc(doc(db, 'expenses', docId), {
        projectId,
        projectName: expenseData.projectName,
        materialCost: expenseData.materialCost || 0,
        laborCost: expenseData.laborCost || 0,
        accessoryCost: expenseData.accessoryCost || 0,
        totalCost: expenseData.totalCost || 0,
        materialBreakdown: expenseData.materialBreakdown || {},
        laborBreakdown: expenseData.laborBreakdown || [],
        updatedAt: serverTimestamp(),
      });
      console.log('♻️ Đã cập nhật chi phí dự án:', projectId, docId);
      return docId;
    }
    // Nếu chưa có -> tạo mới
    return await saveProjectExpense(projectId, expenseData);
  } catch (error) {
    console.error('❌ Lỗi upsert chi phí dự án:', error);
    throw error;
  }
};

// Lấy tất cả chi phí trong tháng
export const getExpensesInMonth = async (year, month) => {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    console.log('🔍 Tìm chi phí trong tháng:', {
      year,
      month,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const q = query(
      collection(db, 'expenses'),
      where('createdAt', '>=', startDate),
      where('createdAt', '<=', endDate),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const expenses = [];

    querySnapshot.forEach((doc) => {
      expenses.push({ id: doc.id, ...doc.data() });
    });

    console.log('📊 Tổng chi phí trong tháng:', expenses.length);
    return expenses;
  } catch (error) {
    console.error('❌ Lỗi khi lấy chi phí trong tháng:', error);
    throw error;
  }
};

// Cập nhật chi phí dự án
export const updateProjectExpense = async (expenseId, updateData) => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    await updateDoc(expenseRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Đã cập nhật chi phí:', expenseId);
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật chi phí:', error);
    throw error;
  }
};

// Xóa chi phí dự án
export const deleteProjectExpense = async (expenseId) => {
  try {
    await deleteDoc(doc(db, 'expenses', expenseId));
    console.log('✅ Đã xóa chi phí:', expenseId);
  } catch (error) {
    console.error('❌ Lỗi khi xóa chi phí:', error);
    throw error;
  }
};

// Xóa tất cả chi phí theo projectId (dùng để dọn dữ liệu test)
export const deleteExpensesByProjectId = async (projectId) => {
  try {
    const q = query(
      collection(db, 'expenses'),
      where('projectId', '==', projectId)
    );
    const snap = await getDocs(q);
    const deletions = [];
    snap.forEach((d) => {
      deletions.push(deleteDoc(doc(db, 'expenses', d.id)));
    });
    await Promise.all(deletions);
    console.log(
      `🧹 Đã xóa ${deletions.length} chi phí cho projectId=${projectId}`
    );
    return deletions.length;
  } catch (error) {
    console.error('❌ Lỗi khi xóa chi phí theo projectId:', error);
    throw error;
  }
};
