/*
 * FILE NÀY ĐÃ BỊ DEPRECATED
 * 
 * Cấu trúc dữ liệu tasks đã được thay đổi từ sub-collection sang map object
 * trong document dự án. Vui lòng sử dụng các hàm trong projectService.js:
 * - updateTaskStatus(projectId, taskKey, newStatus, userId)
 * - updateCustomTask(projectId, taskName, userId)
 * 
 * Cấu trúc dữ liệu mới:
 * {
 *   "projectName": "...",
 *   "tasks": {
 *     "quotation": { "status": "pending" },
 *     "material_separation": { "status": "pending" },
 *     "material_cutting": { "status": "pending" },
 *     "assembly": { "status": "pending" },
 *     "painting": { "status": "pending" },
 *     "shipping": { "status": "pending" },
 *     "other": { "name": "", "status": "pending" }
 *   }
 * }
 */

/*
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
    serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Lấy danh sách công việc của một dự án
 * @param {string} projectId - ID của dự án
 * @returns {Promise<Array>} - Mảng các công việc
 */
export const getTasksForProject = async (projectId) => {
    try {
        const tasksRef = collection(db, `projects/${projectId}/tasks`);
        const q = query(tasksRef, orderBy('createdAt', 'asc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Lỗi khi lấy danh sách công việc:', error);
        throw error;
    }
};

/**
 * Thêm công việc mới vào dự án
 * @param {string} projectId - ID của dự án
 * @param {Object} taskData - Dữ liệu công việc
 * @param {string} userId - ID của người dùng thêm công việc
 * @returns {Promise<Object>} - Công việc đã thêm kèm ID
 */
export const addTask = async (projectId, taskData, userId) => {
    try {
        const tasksRef = collection(db, `projects/${projectId}/tasks`);
        const docRef = await addDoc(tasksRef, {
            ...taskData,
            isCompleted: false,
            createdAt: serverTimestamp(),
            createdBy: userId,
            updatedAt: serverTimestamp()
        });
        
        return {
            id: docRef.id,
            ...taskData,
            isCompleted: false
        };
    } catch (error) {
        console.error('Lỗi khi thêm công việc:', error);
        throw error;
    }
};

/**
 * Cập nhật thông tin công việc
 * @param {string} projectId - ID của dự án
 * @param {string} taskId - ID của công việc
 * @param {Object} updateData - Dữ liệu cập nhật
 * @param {string} userId - ID của người dùng cập nhật
 * @returns {Promise<void>}
 */
export const updateTask = async (projectId, taskId, updateData, userId) => {
    try {
        const taskRef = doc(db, `projects/${projectId}/tasks`, taskId);
        await updateDoc(taskRef, {
            ...updateData,
            updatedAt: serverTimestamp(),
            updatedBy: userId
        });
    } catch (error) {
        console.error('Lỗi khi cập nhật công việc:', error);
        throw error;
    }
};

/**
 * Xóa công việc
 * @param {string} projectId - ID của dự án
 * @param {string} taskId - ID của công việc
 * @returns {Promise<void>}
 */
export const deleteTask = async (projectId, taskId) => {
    try {
        const taskRef = doc(db, `projects/${projectId}/tasks`, taskId);
        await deleteDoc(taskRef);
    } catch (error) {
        console.error('Lỗi khi xóa công việc:', error);
        throw error;
    }
};

/**
 * Đánh dấu công việc đã hoàn thành hoặc chưa hoàn thành
 * @param {string} projectId - ID của dự án
 * @param {string} taskId - ID của công việc
 * @param {boolean} isCompleted - Trạng thái hoàn thành
 * @param {string} userId - ID của người dùng cập nhật
 * @returns {Promise<void>}
 */
export const toggleTaskCompletion = async (projectId, taskId, isCompleted, userId) => {
    try {
        await updateTask(projectId, taskId, { isCompleted }, userId);
    } catch (error) {
        console.error('Lỗi khi đánh dấu hoàn thành công việc:', error);
        throw error;
    }
};
*/ 