// src/api/notificationService.js
import { db } from '../config/firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  doc,
  limit,
} from 'firebase/firestore';

/**
 * Fetches notifications for a specific user, ordered by creation date.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Array>} A list of notifications.
 */
export const getUserNotifications = async (userId) => {
  if (!userId) return [];

  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(30) // To avoid loading too many notifications at once
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

/**
 * Marks a specific notification as read.
 * @param {string} notificationId - The ID of the notification to update.
 * @returns {Promise<void>}
 */
export const markNotificationAsRead = async (notificationId) => {
  if (!notificationId) return;

  try {
    const ref = doc(db, 'notifications', notificationId);
    const data = { read: true };

    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(ref, cleanData);
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};
