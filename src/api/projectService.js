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
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
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
              customerContact: customerData.contactPerson || '',
              customerEmail: customerData.email || '',
              customerPhone: customerData.phone || '',
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
        customerContact: '',
        customerEmail: '',
        customerPhone: '',
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
 * @returns {Promise<Object>} - Dự án đã tạo kèm ID
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

    return {
      id: docRef.id,
      ...projectToSave,
      tasks: defaultTasks,
    };
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

    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      ...projectToUpdate,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  } catch (error) {
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
    throw error;
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
    const q = query(
      projectsRef,
      where('status', '==', status),
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
 * Cập nhật trạng thái công việc của dự án
 * @param {string} projectId - ID dự án
 * @param {string} taskKey - Khóa của công việc (quotation, material_separation, v.v.)
 * @param {string} newStatus - Trạng thái mới (pending, in_progress, completed)
 * @param {string} userId - ID của người dùng cập nhật
 * @returns {Promise<void>}
 */
export const updateTaskStatus = async (
  projectId,
  taskKey,
  newStatus,
  userId
) => {
  try {
    const projectRef = doc(db, 'projects', projectId);
    const updatePath = `tasks.${taskKey}.status`;

    await updateDoc(projectRef, {
      [updatePath]: newStatus,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  } catch (error) {
    throw error;
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
