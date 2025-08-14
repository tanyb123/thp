import { db } from '../config/firebaseConfig';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import storage from '@react-native-firebase/storage';
import { auth } from '../config/firebaseConfig';

// Get discussions for a specific project
export const getProjectDiscussions = async (projectId) => {
  try {
    const q = query(
      collection(db, 'projectDiscussions'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const discussions = [];

    querySnapshot.forEach((doc) => {
      discussions.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return discussions;
  } catch (error) {
    console.error('Error getting project discussions:', error);
    throw error;
  }
};

// Add a new discussion message
export const addDiscussionMessage = async (
  projectId,
  message,
  userId,
  userName,
  userPhotoURL,
  messageType = 'text',
  attachments = []
) => {
  try {
    const discussionData = {
      projectId,
      message,
      userId,
      userName,
      userPhotoURL,
      messageType, // 'text', 'image', 'pdf', 'link'
      attachments,
      isRecalled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, 'projectDiscussions'),
      discussionData
    );
    return {
      id: docRef.id,
      ...discussionData,
    };
  } catch (error) {
    console.error('Error adding discussion message:', error);
    throw error;
  }
};

// Update a discussion message
export const updateDiscussionMessage = async (messageId, message) => {
  try {
    const messageRef = doc(db, 'projectDiscussions', messageId);
    await updateDoc(messageRef, {
      message,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating discussion message:', error);
    throw error;
  }
};

// Recall a discussion message (mark as recalled instead of deleting)
export const recallDiscussionMessage = async (messageId) => {
  try {
    const messageRef = doc(db, 'projectDiscussions', messageId);
    await updateDoc(messageRef, {
      isRecalled: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error recalling discussion message:', error);
    throw error;
  }
};

// Upload file to Firebase Storage using react-native-firebase
export const uploadFileToStorage = async (file, projectId) => {
  try {
    // Validate file
    if (!file || !file.uri) {
      throw new Error('File không hợp lệ');
    }

    // Get current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Người dùng chưa đăng nhập');
    }

    // Create unique file path: discussion_files/{projectId}/{userId}/{timestamp}_{fileName}
    const timestamp = Date.now();
    const fileName = file.name || `file_${timestamp}`;
    const fileExtension = fileName.split('.').pop() || '';
    const uniqueFileName = `${timestamp}_${fileName}`;

    const destinationPath = `discussion_files/${projectId}/${currentUser.uid}/${uniqueFileName}`;

    console.log(
      `[Storage] Bắt đầu upload file: ${fileName} -> ${destinationPath}`
    );

    // Create storage reference
    const storageRef = storage().ref(destinationPath);

    // Upload file using putFile (handles streaming efficiently)
    const uploadTask = await storageRef.putFile(file.uri);

    if (uploadTask.state !== 'success') {
      throw new Error('Upload file thất bại');
    }

    console.log(`[Storage] Upload thành công: ${fileName}`);

    // Get download URL
    const downloadURL = await storageRef.getDownloadURL();

    // Get file metadata
    const metadata = await storageRef.getMetadata();

    // Return attachment object for Firestore
    const attachment = {
      name: fileName,
      url: downloadURL,
      type: file.type || mimeTypeFromExtension(fileExtension),
      size: metadata.size || 0,
      storagePath: destinationPath,
      uploadedAt: new Date().toISOString(),
    };

    console.log(`[Storage] File ready for Firestore:`, attachment);
    return attachment;
  } catch (error) {
    console.error('❌ [Storage] Lỗi upload file:', error);
    throw new Error(`Upload file thất bại: ${error.message}`);
  }
};

// Helper function to determine MIME type from file extension
const mimeTypeFromExtension = (extension) => {
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
  };

  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
};

// Get discussion count for a project
export const getDiscussionCount = async (projectId) => {
  try {
    const q = query(
      collection(db, 'projectDiscussions'),
      where('projectId', '==', projectId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting discussion count:', error);
    return 0;
  }
};

// Real-time listener for project discussions
export const subscribeToProjectDiscussions = (projectId, callback) => {
  const q = query(
    collection(db, 'projectDiscussions'),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const discussions = [];
    querySnapshot.forEach((doc) => {
      discussions.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    callback(discussions);
  });
};
