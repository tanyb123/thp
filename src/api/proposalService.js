// src/api/proposalService.js
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  getDoc, // Add getDoc
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Kiểm tra xem người dùng có quyền tạo đề xuất không
 * @param {string} role - Role của người dùng
 * @returns {boolean}
 */
export const canCreateProposal = (role) => {
  const allowedRoles = ['ky_su', 'pho_giam_doc', 'thuong_mai'];
  return allowedRoles.includes(role);
};

/**
 * Kiểm tra xem người dùng có quyền duyệt đề xuất không
 * @param {string} role - Role của người dùng
 * @returns {boolean}
 */
export const canApproveProposal = (role) => {
  const allowedRoles = ['giam_doc', 'thuong_mai'];
  return allowedRoles.includes(role);
};

/**
 * Tạo phiếu đề xuất vật tư mới
 * @param {Object} proposalData - {projectId, projectName, items:[], createdBy, proposalCode, requiredDate, priority, purpose, createdByName}
 * @returns {Promise<string>} id của phiếu đã tạo
 */
export const createProposal = async (proposalData) => {
  const dataToSave = {
    ...proposalData,
    status: 'pending',
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'purchase_proposals'), dataToSave);
  return docRef.id;
};

/**
 * Lấy danh sách đề xuất của 1 dự án
 * @param {string} projectId
 */
export const getProposalsByProject = async (projectId) => {
  const q = query(
    collection(db, 'purchase_proposals'),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Lấy danh sách đề xuất theo trạng thái
 * @param {string} status - 'pending', 'approved', 'rejected'
 */
export const getProposalsByStatus = async (status) => {
  try {
    // Thử truy vấn với orderBy
    const q = query(
      collection(db, 'purchase_proposals'),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    // Nếu lỗi do chưa có index, thử truy vấn không có orderBy
    if (
      error.code === 'failed-precondition' ||
      error.message.includes('index')
    ) {
      console.warn('Index error, trying without orderBy:', error.message);
      const q = query(
        collection(db, 'purchase_proposals'),
        where('status', '==', status)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      // Nếu là lỗi khác thì throw
      throw error;
    }
  }
};

/**
 * Cập nhật trạng thái phiếu (approved / rejected)
 * @param {string} proposalId
 * @param {'approved'|'rejected'} status
 * @param {string} approvedBy uid
 * @param {string} approvedByName tên người duyệt
 * @param {string} comment ghi chú khi duyệt/từ chối
 */
export const updateProposalStatus = async (
  proposalId,
  status,
  approvedBy,
  approvedByName,
  comment = ''
) => {
  const proposalRef = doc(db, 'purchase_proposals', proposalId);

  // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
  const updateData = {
    status,
    approvedBy,
    approvedByName,
    approvedAt: serverTimestamp(),
    comment,
  };

  const cleanData = Object.fromEntries(
    Object.entries(updateData).filter(([_, value]) => value !== undefined)
  );

  await updateDoc(proposalRef, cleanData);

  // Create a notification for the creator
  if (status === 'approved' || status === 'rejected') {
    try {
      const proposalSnap = await getDoc(proposalRef);
      if (proposalSnap.exists()) {
        const proposalData = proposalSnap.data();
        if (proposalData.createdBy && proposalData.createdBy !== approvedBy) {
          const notificationMessage =
            status === 'approved'
              ? `Đề xuất "${
                  proposalData.proposalCode || 'Không có mã'
                }" đã được phê duyệt.`
              : `Đề xuất "${
                  proposalData.proposalCode || 'Không có mã'
                }" đã bị từ chối.`;

          const notificationData = {
            userId: proposalData.createdBy,
            message: notificationMessage,
            proposalId: proposalId,
            read: false,
            createdAt: serverTimestamp(),
            type:
              status === 'approved' ? 'PROPOSAL_APPROVED' : 'PROPOSAL_REJECTED',
            navLink: {
              screen: 'ProposalList',
            },
          };
          await addDoc(collection(db, 'notifications'), notificationData);
        }
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }
};

/**
 * Cập nhật giá vật tư trong phiếu đề xuất
 * @param {string} proposalId - ID của phiếu đề xuất
 * @param {Array} materials - Mảng vật tư với thông tin giá đã cập nhật
 * @returns {Promise<void>}
 */
export const updateProposalMaterialPrices = async (proposalId, materials) => {
  const ref = doc(db, 'purchase_proposals', proposalId);

  // Tính tổng giá trị đơn hàng
  let totalOrderValue = 0;
  materials.forEach((item) => {
    if (item.price && item.quantity) {
      const price = parseFloat(item.price);
      const quantity = parseFloat(item.quantity);
      if (!isNaN(price) && !isNaN(quantity)) {
        totalOrderValue += price * quantity;
      }
    }
  });

  const updateData = {
    items: materials,
    hasPrices: true,
    totalValue: totalOrderValue,
    priceUpdatedAt: serverTimestamp(),
  };

  // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
  const cleanData = Object.fromEntries(
    Object.entries(updateData).filter(([_, value]) => value !== undefined)
  );

  await updateDoc(ref, cleanData);
};
