// src/api/purchaseOrderService.js
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { httpsCallable, getFunctions } from 'firebase/functions';

// Get Firebase Functions instance for asia-southeast1 region
const functionsInstance = getFunctions(undefined, 'asia-southeast1');

export const createPO = async (poData) => {
  const dataToSave = {
    ...poData,
    status: 'created',
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'purchase_orders'), dataToSave);
  return docRef.id;
};

export const getPOsByProject = async (projectId) => {
  const q = query(
    collection(db, 'purchase_orders'),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getAllPOs = async () => {
  const snap = await getDocs(
    query(collection(db, 'purchase_orders'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Saves PO receipt confirmation data to Firestore
 * This function assumes files have already been uploaded to Drive
 * @param {Object} params - Parameters
 * @param {string} params.poId - Purchase order ID
 * @param {string} params.projectId - Project ID
 * @param {Array} params.filesToSave - Array of file objects to save (with id, name, url)
 * @param {string} params.remarks - Optional remarks
 * @returns {Promise<Object>} - Result with success status
 */
export const savePOReceiptConfirmation = async ({
  poId,
  projectId,
  filesToSave,
  remarks = '',
}) => {
  const callable = httpsCallable(
    functionsInstance,
    'savePOReceiptConfirmation'
  );
  const res = await callable({ poId, projectId, filesToSave, remarks });
  return res.data;
};
