//src/api/projectService.js
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
  arrayUnion,
  runTransaction,
} from 'firebase/firestore';
import { db, functions } from '../config/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { getCustomerById } from './customerService'; // Import getCustomerById

/**
 * Lấy tất cả dự án
 * @returns {Promise<Array>} - Mảng dự án
 */
export const getProjects = async () => {
  try {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    // Dữ liệu đã được denormalize, không cần query thêm
    const projects = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return projects;
  } catch (error) {
    throw error;
  }
};

/**
 * Lấy dự án theo ID kèm thông tin khách hàng
 * @param {string} projectId - ID dự án
 * @returns {Promise<Object|null>} - Dữ liệu dự án hoặc null nếu không tìm thấy
 */
export const getProjectById = async (projectId) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectSnapshot = await getDoc(projectRef);

    if (projectSnapshot.exists()) {
      const projectData = {
        id: projectSnapshot.id,
        ...projectSnapshot.data(),
      };

      // Nếu dự án có customerId, lấy thông tin khách hàng
      if (projectData.customerId) {
        try {
          const customerRef = doc(db, 'customers', projectData.customerId);
          const customerSnapshot = await getDoc(customerRef);

          if (customerSnapshot.exists()) {
            const customerData = customerSnapshot.data();
            // Thêm thông tin khách hàng vào dự án
            return {
              ...projectData,
              customerName: customerData.name || 'Không xác định',
              customerContactPerson: customerData.contactPerson || '',
              customerEmail: customerData.email || '',
              customerPhone: customerData.phone || '',
              customerAddress: customerData.address || '',
              customerTaxCode: customerData.taxCode || '',
              customer: {
                id: projectData.customerId,
                ...customerData,
              },
            };
          }
        } catch (error) {
          console.error(
            `Lỗi khi lấy thông tin khách hàng cho dự án ${projectId}:`,
            error
          );
        }
      }

      // Trả về dự án gốc nếu không có customerId hoặc có lỗi
      return {
        ...projectData,
        customerName: 'Không xác định',
        customerContactPerson: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        customerTaxCode: '',
      };
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Tạo dự án mới
 * @param {Object} projectData - Dữ liệu dự án
 * @param {string} userId - ID của người dùng tạo dự án
 * @returns {Promise<string>} - ID của dự án đã tạo
 */
export const createProject = async (projectData, userId) => {
  try {
    const projectToSave = { ...projectData };

    // Denormalization: Fetch and add customerName if customerId exists
    if (projectToSave.customerId) {
      const customer = await getCustomerById(projectToSave.customerId);
      if (customer) {
        projectToSave.customerName = customer.name;
      }
    }

    // Tạo cấu trúc tasks mặc định
    const defaultTasks = {
      quotation: { status: 'pending' },
      material_separation: { status: 'pending' },
      material_purchasing: {
        label: 'Mua vật tư & phụ kiện',
        status: 'pending',
      },
      material_cutting: { status: 'pending' },
      assembly: { status: 'pending' },
      painting: { status: 'pending' },
      shipping: { status: 'pending' },
      other: { name: '', status: 'pending' },
    };

    const docRef = await addDoc(collection(db, 'projects'), {
      ...projectToSave,
      tasks: defaultTasks, // Thêm cấu trúc tasks mặc định
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
    });

    // Trả về ID của dự án vừa tạo
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

/**
 * Cập nhật thông tin dự án
 * @param {string} projectId - ID dự án
 * @param {Object} projectData - Dữ liệu dự án cập nhật
 * @param {string} userId - ID của người dùng cập nhật dự án
 * @returns {Promise<void>}
 */
export const updateProject = async (projectId, projectData, userId) => {
  try {
    const projectToUpdate = { ...projectData };

    // Denormalization: If customerId is being updated, also update customerName
    if (projectToUpdate.customerId) {
      const customer = await getCustomerById(projectToUpdate.customerId);
      if (customer) {
        projectToUpdate.customerName = customer.name;
      } else {
        projectToUpdate.customerName = 'Không xác định'; // Handle case where customer might not be found
      }
    }

    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(projectToUpdate).filter(
        ([_, value]) => value !== undefined
      )
    );

    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      ...cleanData,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật dự án:', error);
    throw error;
  }
};

/**
 * Xóa dự án
 * @param {string} projectId - ID dự án
 * @returns {Promise<void>}
 */
export const deleteProject = async (projectId) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    await deleteDoc(projectRef);
  } catch (error) {
    console.error('Error deleting project:', error);
    throw new Error('Không thể xóa dự án. Vui lòng thử lại.');
  }
};

/**
 * Lấy dự án theo khách hàng
 * @param {string} customerId - ID khách hàng
 * @returns {Promise<Array>} - Mảng dự án thuộc khách hàng
 */
export const getProjectsByCustomer = async (customerId) => {
  try {
    const projectsRef = collection(db, 'projects');
    const q = query(
      projectsRef,
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw error;
  }
};

/**
 * Lấy dự án theo trạng thái
 * @param {string} status - Trạng thái dự án (pending, in-progress, completed, cancelled)
 * @returns {Promise<Array>} - Mảng dự án thuộc trạng thái đã chỉ định
 */
export const getProjectsByStatus = async (status) => {
  try {
    const projectsRef = collection(db, 'projects');

    // Special case for 'all' - return all projects
    if (status === 'all') {
      const q = query(projectsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }

    // Map filter keys to actual status values in the database
    let statusValue = status;
    if (status === 'in_progress') {
      statusValue = 'in-progress';
    } else if (status === 'production_complete') {
      statusValue = 'production-complete';
    } else if (status === 'delivered') {
      statusValue = 'delivered';
    }

    const q = query(
      projectsRef,
      where('status', '==', statusValue),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw error;
  }
};

/**
 * Tìm kiếm dự án theo tên
 * @param {string} searchTerm - Từ khóa tìm kiếm
 * @returns {Promise<Array>} - Mảng dự án phù hợp
 */
export const searchProjects = async (searchTerm) => {
  try {
    const projectsRef = collection(db, 'projects');
    const nameQuery = query(
      projectsRef,
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff')
    );

    const querySnapshot = await getDocs(nameQuery);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    throw error;
  }
};

/**
 * Updates the status of a specific task within a project.
 * This is a targeted update to ensure it passes security rules for non-admin users.
 * @param {string} projectId The ID of the project to update.
 * @param {string} taskKey The key of the task to update (e.g., 'material_separation').
 * @param {string} newStatus The new status for the task.
 */
export const updateTaskStatus = async (projectId, taskKey, newStatus) => {
  if (!projectId || !taskKey || !newStatus) {
    throw new Error('Cần có ID dự án, khóa công việc và trạng thái mới.');
  }
  try {
    const projectRef = doc(db, 'projects', projectId);
    // Construct the field path dynamically
    const fieldPath = `tasks.${taskKey}.status`;
    await updateDoc(projectRef, {
      [fieldPath]: newStatus,
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    if (error.code === 'permission-denied') {
      throw new Error('Bạn không có quyền cập nhật trạng thái công việc này.');
    }
    throw new Error(
      'Không thể cập nhật trạng thái công việc. Vui lòng thử lại.'
    );
  }
};

/**
 * Cập nhật tên công việc "other"
 * @param {string} projectId - ID dự án
 * @param {string} taskName - Tên công việc khác
 * @param {string} userId - ID của người dùng cập nhật
 * @returns {Promise<void>}
 */
export const updateCustomTask = async (projectId, taskName, userId) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const updatePath = `tasks.other.name`;

    await updateDoc(projectRef, {
      [updatePath]: taskName,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Updates the status of a specific workflow stage within a project.
 * This is a targeted update to ensure it passes security rules for non-admin users.
 * @param {string} projectId The ID of the project to update.
 * @param {string} stageId The ID of the stage to update.
 * @param {string} newStatus The new status for the stage.
 * @param {string} assignedToId The ID of the user assigned to the stage.
 */
export const updateWorkflowStageStatus = async (
  projectId,
  stageId,
  newStatus,
  assignedToId = null
) => {
  console.log('🔄 updateWorkflowStageStatus called:', {
    projectId,
    stageId,
    newStatus,
    assignedToId,
  });

  // 🔧 ALWAYS use transaction for workflowStages updates to ensure consistency
  console.log(
    '🔄 Using transaction for workflowStages update (recommended approach)'
  );

  await runTransaction(db, async (transaction) => {
    const ref = doc(db, 'projects', projectId);
    const snap = await transaction.get(ref);

    if (!snap.exists()) {
      console.error('❌ Project not found:', projectId);
      throw new Error('Project not found');
    }

    const stages = snap.data().workflowStages || [];
    console.log(
      '📋 Current stages:',
      stages.map((s) => ({
        stageId: s.stageId,
        processName: s.processName,
        status: s.status,
      }))
    );

    console.log('🔍 Looking for stageId:', stageId);
    console.log(
      '🔍 Available stageIds:',
      stages.map((s) => s.stageId)
    );
    console.log('🔍 StageId type:', typeof stageId);
    console.log(
      '🔍 Available stageId types:',
      stages.map((s) => typeof s.stageId)
    );

    const idx = stages.findIndex((s) => s.stageId === stageId);
    console.log('🎯 Found stage at index:', idx);

    if (idx === -1) {
      console.error('❌ Stage not found:', stageId);
      console.error(
        'Available stageIds:',
        stages.map((s) => s.stageId)
      );
      throw new Error('Stage not found');
    }

    console.log(`🎯 Found stage at index ${idx}:`, {
      stageId: stages[idx].stageId,
      processName: stages[idx].processName,
      currentStatus: stages[idx].status,
      newStatus,
    });

    stages[idx] = {
      ...stages[idx],
      status: newStatus,
      ...(assignedToId ? { assignedToId } : {}),
    };

    console.log('💾 Updating stage to:', stages[idx]);
    transaction.update(ref, {
      workflowStages: stages,
      updatedAt: serverTimestamp(),
    });
    console.log('✅ Transaction update completed');
  });
};

/**
 * Cập nhật chi tiết (status, notes, files) cho một công đoạn cụ thể
 * @param {string} projectId
 * @param {string} stageId
 * @param {Object} data - {status?, notes?, files?}
 */
export const updateStageDetails = async (projectId, stageId, data) => {
  try {
    const projectRef = doc(db, 'projects', projectId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(projectRef);
      if (!snap.exists()) throw new Error('Project not found');
      const project = snap.data();
      const stages = project.workflowStages || [];
      const idx = stages.findIndex((s) => s.stageId === stageId);
      if (idx === -1) throw new Error('Stage not found');

      // Loại bỏ các field undefined từ data
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );

      stages[idx] = {
        ...stages[idx],
        ...cleanData, // status, notes, files
      };

      tx.update(projectRef, {
        workflowStages: stages,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error('Error updating stage details:', error);
    throw new Error('Không thể cập nhật chi tiết công đoạn.');
  }
};

const ProjectService = {
  /**
   * Calls a cloud function to create folders for a project in Google Drive.
   * @param {string} projectId - The ID of the project.
   * @param {string} accessToken - The Google access token.
   * @returns {Promise<any>} The result from the cloud function.
   */
  async createProjectFolders(projectId, accessToken) {
    try {
      const createFolders = httpsCallable(functions, 'createProjectFolders');
      const result = await createFolders({ projectId, accessToken });
      return result.data;
    } catch (error) {
      console.error('Error creating project folders:', error);
      throw error;
    }
  },

  /**
   * Imports materials from a Google Sheet file in Drive.
   * @param {string} fileId - The ID of the Google Sheet file.
   * @param {string} projectId - The ID of the project to associate materials with.
   * @param {string} accessToken - The user's Google access token.
   * @returns {Promise<any>} The result from the cloud function.
   */
  async importMaterialsFromDrive(fileId, projectId, accessToken) {
    try {
      const importMaterials = httpsCallable(
        functions,
        'importMaterialsFromDrive'
      );
      const result = await importMaterials({ fileId, projectId, accessToken });
      return result.data;
    } catch (error) {
      console.error('Error importing materials from drive:', error);
      throw error;
    }
  },

  /**
   * Deletes a file from Google Drive using a cloud function.
   * @param {string} fileId - The ID of the file to delete.
   * @param {string} accessToken - The user's Google access token.
   * @returns {Promise<any>}
   */
  async deleteFileFromDrive(fileId, accessToken) {
    try {
      const deleteFile = httpsCallable(functions, 'deleteFileFromDrive');
      const result = await deleteFile({ fileId, accessToken });
      return result.data;
    } catch (error) {
      console.error('Error deleting file from drive:', error);
      throw error;
    }
  },

  /**
   * Triggers processing of a payable ledger from a Google Sheet.
   * @param {string} fileId - The ID of the Google Sheet.
   * @param {string} accessToken - The Google access token.
   * @returns {Promise<any>}
   */
  async processPayableLedgerFromDrive(fileId, accessToken) {
    try {
      const processLedger = httpsCallable(
        functions,
        'processPayableLedgerFromDrive'
      );
      const result = await processLedger({ fileId, accessToken });
      return result.data;
    } catch (error) {
      console.error('Error processing payable ledger:', error);
      throw error;
    }
  },
};

/**
 * Assign worker to a project stage
 * @param {string} projectId - Project ID
 * @param {string} stageId - Stage ID
 * @param {string} workerId - Worker ID
 * @param {string} workerName - Worker name
 * @returns {Promise<void>}
 */
export const assignWorkerToStage = async (
  projectId,
  stageId,
  workerId,
  workerName
) => {
  try {
    const projectRef = doc(db, 'projects', projectId);

    await runTransaction(db, async (transaction) => {
      const projectDoc = await transaction.get(projectRef);

      if (!projectDoc.exists()) {
        throw new Error('Project not found');
      }

      const projectData = projectDoc.data();
      const workflowStages = projectData.workflowStages || [];

      // Find and update the specific stage
      const updatedStages = workflowStages.map((stage) => {
        if (stage.stageId === stageId) {
          const assignedWorkers = stage.assignedWorkers || [];

          // Check if worker is already assigned
          if (!assignedWorkers.includes(workerId)) {
            return {
              ...stage,
              assignedWorkers: [...assignedWorkers, workerId],
              assignedWorkerNames: [
                ...(stage.assignedWorkerNames || []),
                workerName,
              ],
              status: 'assigned', // Update status to assigned
              assignedAt: new Date(),
            };
          }
        }
        return stage;
      });

      // Update the project with new stage assignments
      transaction.update(projectRef, {
        workflowStages: updatedStages,
        updatedAt: serverTimestamp(),
      });
    });

    console.log(
      `Successfully assigned ${workerName} to stage ${stageId} in project ${projectId}`
    );
  } catch (error) {
    console.error('Error assigning worker to stage:', error);
    throw error;
  }
};

export const saveProjectAccessoryPrice = async (projectId, accessoryPrice) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      accessoryPrice: Number(accessoryPrice || 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Lỗi khi lưu giá phụ kiện:', error);
    throw error;
  }
};

export const getProjectAccessoryPrice = async (projectId) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (projectSnap.exists()) {
      return projectSnap.data().accessoryPrice || 0;
    }
    return 0;
  } catch (error) {
    console.error('Lỗi khi lấy giá phụ kiện:', error);
    return 0;
  }
};

export default ProjectService;
