// src/api/attendanceService.js

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Utility to get YYYY-MM-DD formatted date string in local timezone.
 * @param {Date} [dateObj]
 */
const formatDate = (dateObj = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Build document reference for a user & date (defaults to today)
 */
const attendanceDocRef = (userId, dateStr = formatDate()) =>
  doc(db, 'attendance', `${userId}_${dateStr}`);

/**
 * Fetch today (or specific date) attendance for a user
 * @param {string} userId
 * @param {string} [dateStr] formatted YYYY-MM-DD
 */
export const getAttendance = async (userId, dateStr = formatDate()) => {
  const ref = attendanceDocRef(userId, dateStr);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return null;
};

/**
 * Clock in: set clockIn timestamp if not already set.
 * Returns updated attendance document.
 */
export const clockIn = async (userId, timestamp = new Date()) => {
  const dateStr = formatDate(timestamp);
  const ref = attendanceDocRef(userId, dateStr);
  const data = {
    clockIn: timestamp,
    updatedAt: serverTimestamp(),
  };

  const existing = await getDoc(ref);
  if (existing.exists()) {
    // Only set clockIn if not yet recorded
    if (!existing.data().clockIn) {
      // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );
      await updateDoc(ref, cleanData);
    }
  } else {
    data.createdAt = serverTimestamp();
    await setDoc(ref, data);
  }
  return (await getDoc(ref)).data();
};

/**
 * Clock out: set clockOut timestamp.
 */
export const clockOut = async (userId, timestamp = new Date()) => {
  const dateStr = formatDate(timestamp);
  const ref = attendanceDocRef(userId, dateStr);
  const data = {
    clockOut: timestamp,
    updatedAt: serverTimestamp(),
  };
  const existing = await getDoc(ref);
  if (existing.exists()) {
    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    await updateDoc(ref, cleanData);
  } else {
    // In case user forget to clock in, create new doc
    await setDoc(ref, {
      userId,
      date: dateStr,
      clockOut: timestamp,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return (await getDoc(ref)).data();
};

/**
 * Add / update overtime hours (floating number of hours)
 */
export const addOvertime = async (userId, hours, timestamp = new Date()) => {
  const dateStr = formatDate(timestamp);
  const ref = attendanceDocRef(userId, dateStr);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = {
      overtime: hours,
      updatedAt: serverTimestamp(),
    };
    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    await updateDoc(ref, cleanData);
  } else {
    await setDoc(ref, {
      userId,
      date: dateStr,
      overtime: hours,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return (await getDoc(ref)).data();
};

/**
 * Mark presence boolean for the day (mass attendance)
 */
export const setPresence = async (
  userId,
  present = true,
  timestamp = new Date()
) => {
  const dateStr = formatDate(timestamp);
  const ref = attendanceDocRef(userId, dateStr);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = {
      present,
      updatedAt: serverTimestamp(),
    };
    // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    await updateDoc(ref, cleanData);
  } else {
    await setDoc(ref, {
      userId,
      date: dateStr,
      present,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return (await getDoc(ref)).data();
};

/**
 * Utility to determine current status for UI
 * Returns: 'none' | 'clocked_in' | 'clocked_out'
 */
export const getAttendanceStatus = (attendanceDoc) => {
  if (!attendanceDoc) return 'none';
  if (attendanceDoc.clockIn && !attendanceDoc.clockOut) return 'clocked_in';
  if (attendanceDoc.clockIn && attendanceDoc.clockOut) return 'clocked_out';
  return 'none';
};
/**
 * Get attendance history for a user by month and year
 * @param {string} userId
 * @param {number} year
 * @param {number} month (1-12)
 * @returns {Array} Array of attendance records
 */
export const getAttendanceHistory = async (userId, year, month) => {
  try {
    // Tạo range date cho tháng
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Ngày cuối cùng của tháng

    // Format dates để tìm documents
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    // Tạo query để lấy tất cả attendance records trong tháng
    const attendanceRef = collection(db, 'attendance');

    // Lấy tất cả documents và filter theo date range
    const querySnapshot = await getDocs(attendanceRef);
    const attendanceRecords = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Kiểm tra xem document có thuộc user này không
      if (data.userId === userId || doc.id.startsWith(userId + '_')) {
        // Trích xuất ngày từ document ID (format: userId_YYYY-MM-DD)
        let docDate = data.date;
        if (!docDate && doc.id.includes('_')) {
          const datePart = doc.id.split('_')[1];
          if (datePart && datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
            docDate = datePart;
          }
        }

        // Kiểm tra xem document có thuộc tháng cần tìm không
        if (docDate && docDate >= startDateStr && docDate <= endDateStr) {
          attendanceRecords.push({
            id: doc.id,
            ...data,
            clockIn: data.clockIn,
            clockOut: data.clockOut,
            overtime: data.overtime || 0,
            date: docDate,
          });
        }
      }
    });

    // Sắp xếp theo ngày
    attendanceRecords.sort((a, b) => a.date.localeCompare(b.date));

    return attendanceRecords;
  } catch (error) {
    console.error('Error getting attendance history:', error);
    throw error;
  }
};

/**
 * Get attendance summary for a user by month and year
 * @param {string} userId
 * @param {number} year
 * @param {number} month (1-12)
 * @returns {Object} Summary object with total days, hours, overtime
 */
export const getAttendanceSummary = async (userId, year, month) => {
  try {
    const history = await getAttendanceHistory(userId, year, month);

    const summary = {
      totalDays: history.length,
      totalHours: 0,
      totalOvertime: 0,
      averageHoursPerDay: 0,
    };

    history.forEach((record) => {
      if (record.clockIn && record.clockOut) {
        const startTime = record.clockIn.toDate
          ? record.clockIn.toDate()
          : new Date(record.clockIn);
        const endTime = record.clockOut.toDate
          ? record.clockOut.toDate()
          : new Date(record.clockOut);
        const hours = (endTime - startTime) / (1000 * 60 * 60);
        summary.totalHours += hours;
      }

      if (record.overtime) {
        summary.totalOvertime += record.overtime;
      }
    });

    if (summary.totalDays > 0) {
      summary.averageHoursPerDay = summary.totalHours / summary.totalDays;
    }

    return summary;
  } catch (error) {
    console.error('Error getting attendance summary:', error);
    throw error;
  }
};

