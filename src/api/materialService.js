import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// Lấy danh sách tất cả vật liệu
export const getMaterials = async () => {
  try {
    const materialsSnap = await getDocs(
      query(collection(db, 'materials'), orderBy('name'))
    );
    const materials = [];
    materialsSnap.forEach((doc) => {
      materials.push({ id: doc.id, ...doc.data() });
    });
    return materials;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách vật liệu:', error);
    throw error;
  }
};

// Lấy vật liệu theo ID
export const getMaterialById = async (materialId) => {
  try {
    const materialRef = doc(db, 'materials', materialId);
    const materialSnap = await getDoc(materialRef);
    if (materialSnap.exists()) {
      return { id: materialSnap.id, ...materialSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Lỗi khi lấy vật liệu:', error);
    throw error;
  }
};

// Thêm vật liệu mới
export const addMaterial = async (materialData, userId) => {
  try {
    const materialToAdd = {
      ...materialData,
      pricePerKg: Number(materialData.pricePerKg || 0),
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    
    // Loại bỏ các field có giá trị undefined
    const cleanData = Object.fromEntries(
      Object.entries(materialToAdd).filter(([_, value]) => value !== undefined)
    );
    
    const docRef = await addDoc(collection(db, 'materials'), cleanData);
    return docRef.id;
  } catch (error) {
    console.error('Lỗi khi thêm vật liệu:', error);
    throw error;
  }
};

// Cập nhật vật liệu
export const updateMaterial = async (materialId, materialData, userId) => {
  try {
    const materialToUpdate = {
      ...materialData,
      pricePerKg: Number(materialData.pricePerKg || 0),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    
    // Loại bỏ các field có giá trị undefined
    const cleanData = Object.fromEntries(
      Object.entries(materialToUpdate).filter(([_, value]) => value !== undefined)
    );
    
    const materialRef = doc(db, 'materials', materialId);
    await updateDoc(materialRef, cleanData);
  } catch (error) {
    console.error('Lỗi khi cập nhật vật liệu:', error);
    throw error;
  }
};

// Xóa vật liệu
export const deleteMaterial = async (materialId) => {
  try {
    const materialRef = doc(db, 'materials', materialId);
    await deleteDoc(materialRef);
  } catch (error) {
    console.error('Lỗi khi xóa vật liệu:', error);
    throw error;
  }
};

// Lấy giá vật liệu theo tên
export const getMaterialPriceByName = async (materialName) => {
  try {
    const materialsSnap = await getDocs(
      query(
        collection(db, 'materials'),
        where('name', '==', materialName)
      )
    );
    
    if (!materialsSnap.empty) {
      const material = materialsSnap.docs[0].data();
      return material.pricePerKg || 0;
    }
    return 0;
  } catch (error) {
    console.error('Lỗi khi lấy giá vật liệu:', error);
    return 0;
  }
};

// Lấy tất cả giá vật liệu
export const getAllMaterialPrices = async () => {
  try {
    const materials = await getMaterials();
    const prices = {};
    materials.forEach((material) => {
      prices[material.name] = material.pricePerKg || 0;
    });
    return prices;
  } catch (error) {
    console.error('Lỗi khi lấy giá vật liệu:', error);
    return {};
  }
};


















