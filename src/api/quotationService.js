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
    serverTimestamp 
} from 'firebase/firestore';
// import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db } from '../config/firebaseConfig';
// import * as FileSystem from 'expo-file-system';

/**
 * Save quotation metadata to Firestore.
 * The PDF is assumed to be already created and stored by a cloud function.
 * @param {string} projectId - Project ID
 * @param {Object} quotationData - All quotation data
 * @param {string} pdfUrl - Public URL to the generated PDF file in Firebase Storage
 * @param {string} userId - ID of the user creating the quotation
 * @returns {Promise<Object>} - Saved quotation data with Firestore document ID
 */
export const saveQuotation = async (projectId, quotationData, pdfUrl, userId) => {
    try {
        console.log('Saving quotation metadata to Firestore for project:', projectId);
        
        // Kiểm tra các tham số bắt buộc
        if (!projectId) {
            throw new Error('ProjectId không được để trống');
        }
        
        if (!pdfUrl) {
            throw new Error('PDF URL không được để trống');
        }
        
        if (!userId) {
            throw new Error('UserId không được để trống');
        }
        
        // 1. Save quotation data to Firestore
        const quotationRef = collection(db, `projects/${projectId}/quotations`);
        const docRef = await addDoc(quotationRef, {
            ...quotationData,
            pdfUrl, // Use the provided URL directly
            createdAt: serverTimestamp(),
            createdBy: userId,
            updatedAt: serverTimestamp()
        });
        
        console.log('Quotation metadata saved with ID:', docRef.id);
        
        // 2. Update project task status
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
            'tasks.quotation.status': 'completed',
            'tasks.quotation.completedAt': serverTimestamp(),
            'tasks.quotation.completedBy': userId,
            updatedAt: serverTimestamp(),
            updatedBy: userId
        });
        
        console.log('Project status updated.');
        
        return {
            id: docRef.id,
            pdfUrl: pdfUrl,
            ...quotationData
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
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
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
        const quotationRef = doc(db, `projects/${projectId}/quotations`, quotationId);
        const quotationSnapshot = await getDoc(quotationRef);
        
        if (quotationSnapshot.exists()) {
            return {
                id: quotationSnapshot.id,
                ...quotationSnapshot.data()
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error getting quotation by ID:', error);
        throw error;
    }
}; 