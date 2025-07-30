// src/api/attendanceService.js

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
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
    userId,
    date: dateStr,
    clockIn: timestamp,
    updatedAt: serverTimestamp(),
  };

  const existing = await getDoc(ref);
  if (existing.exists()) {
    // Only set clockIn if not yet recorded
    if (!existing.data().clockIn) {
      await updateDoc(ref, data);
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
    await updateDoc(ref, data);
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
    await updateDoc(ref, {
      overtime: hours,
      updatedAt: serverTimestamp(),
    });
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
    await updateDoc(ref, {
      present,
      updatedAt: serverTimestamp(),
    });
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
