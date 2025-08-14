//src/api/quotationService.js
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
// import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db } from '../config/firebaseConfig';
// import * as FileSystem from 'expo-file-system';

/**
 * Save quotation metadata to Firestore.
 * The PDF is assumed to be already created and stored by a cloud function.
 * @param {string} projectId - Project ID
 * @param {Object} quotationData - All quotation data, including pdfUrl and createdBy
 * @returns {Promise<Object>} - Saved quotation data with Firestore document ID
 */
export const saveQuotation = async (projectId, quotationData) => {
  try {
    console.log(
      'Saving quotation metadata to Firestore for project:',
      projectId
    );

    // Destructure and validate required fields from quotationData
    const { pdfUrl, createdBy } = quotationData;

    if (!projectId) {
      throw new Error('ProjectId không được để trống');
    }

    if (!pdfUrl) {
      throw new Error('PDF URL không được để trống');
    }

    if (!createdBy) {
      throw new Error('UserId (createdBy) không được để trống');
    }

    // 1. Save quotation data to Firestore
    const quotationRef = collection(db, `projects/${projectId}/quotations`);
    const docRef = await addDoc(quotationRef, {
      ...quotationData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(), // Add updatedAt for consistency
    });

    console.log('Quotation metadata saved with ID:', docRef.id);

    // 2. Update project task status
    const projectRef = doc(db, 'projects', projectId);
    const updateData = {
      'tasks.quotation.status': 'completed',
      'tasks.quotation.completedAt': serverTimestamp(),
      'tasks.quotation.completedBy': createdBy,
      updatedAt: serverTimestamp(),
      updatedBy: createdBy,
    };

    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(projectRef, cleanData);

    console.log('Project status updated.');

    return {
      id: docRef.id,
      ...quotationData,
    };
  } catch (error) {
    console.error('Error saving quotation metadata:', error);
    throw error;
  }
};

/**
 * Get all quotations for a specific project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} - Array of quotations
 */
export const getQuotationsByProject = async (projectId) => {
  try {
    const quotationsRef = collection(db, `projects/${projectId}/quotations`);
    const q = query(quotationsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting quotations:', error);
    throw error;
  }
};

/**
 * Get a specific quotation by ID
 * @param {string} projectId - Project ID
 * @param {string} quotationId - Quotation ID
 * @returns {Promise<Object|null>} - Quotation data or null if not found
 */
export const getQuotationById = async (projectId, quotationId) => {
  try {
    const quotationRef = doc(
      db,
      `projects/${projectId}/quotations`,
      quotationId
    );
    const quotationSnapshot = await getDoc(quotationRef);

    if (quotationSnapshot.exists()) {
      return {
        id: quotationSnapshot.id,
        ...quotationSnapshot.data(),
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting quotation by ID:', error);
    throw error;
  }
};
