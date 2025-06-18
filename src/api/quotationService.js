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
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../config/firebaseConfig';

/**
 * Save quotation data to Firestore and upload PDF to Firebase Storage
 * @param {string} projectId - Project ID
 * @param {Object} quotationData - All quotation data
 * @param {string} pdfLocalPath - Local path to the generated PDF file
 * @param {string} userId - ID of the user creating the quotation
 * @returns {Promise<Object>} - Saved quotation data with ID and download URL
 */
export const saveQuotation = async (projectId, quotationData, pdfLocalPath, userId) => {
    try {
        // 1. Upload PDF to Firebase Storage
        const storage = getStorage();
        const quotationId = `quotation_${Date.now()}`;
        const storagePath = `quotations/${projectId}/${quotationId}.pdf`;
        const storageRef = ref(storage, storagePath);
        
        // Read the file as a blob
        const response = await fetch(`file://${pdfLocalPath}`);
        const blob = await response.blob();
        
        // Upload the blob
        await uploadBytes(storageRef, blob);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);
        
        // 2. Save quotation data to Firestore
        const quotationRef = collection(db, `projects/${projectId}/quotations`);
        const docRef = await addDoc(quotationRef, {
            ...quotationData,
            quotationId,
            pdfUrl: downloadURL,
            createdAt: serverTimestamp(),
            createdBy: userId,
            updatedAt: serverTimestamp()
        });
        
        // 3. Update project task status
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
            'tasks.quotation.status': 'completed',
            'tasks.quotation.completedAt': serverTimestamp(),
            'tasks.quotation.completedBy': userId,
            updatedAt: serverTimestamp(),
            updatedBy: userId
        });
        
        return {
            id: docRef.id,
            quotationId,
            pdfUrl: downloadURL,
            ...quotationData
        };
    } catch (error) {
        console.error('Error saving quotation:', error);
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