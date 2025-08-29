// src/api/requestService.js
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// --- Leave Requests ---
export const submitLeaveRequest = async ({
  userId,
  userName,
  type,
  startDate,
  endDate,
  reason,
}) => {
  const colRef = collection(db, 'leave_requests');
  const payload = {
    userId,
    userName: userName || '',
    type,
    startDate,
    endDate,
    reason,
    status: 'pending',
    submittedAt: serverTimestamp(),
  };
  const docRef = await addDoc(colRef, payload);
  return { id: docRef.id, ...payload };
};

export const fetchPendingLeaveRequests = async () => {
  const colRef = collection(db, 'leave_requests');
  const q = query(
    colRef,
    where('status', '==', 'pending'),
    orderBy('submittedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    requestType: 'leave',
  }));
};

export const fetchLeaveRequestsByUser = async (userId) => {
  const colRef = collection(db, 'leave_requests');
  const q = query(colRef, where('userId', '==', userId));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Sort by submittedAt desc on client to avoid composite index requirement
  items.sort((a, b) => {
    const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
    const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
    return tb - ta;
  });
  return items;
};

export const updateLeaveRequestStatus = async (
  id,
  status,
  managerNote = ''
) => {
  const ref = doc(db, 'leave_requests', id);
  await updateDoc(ref, { status, managerNote, decidedAt: serverTimestamp() });
};

// --- Advance Salary Requests ---
export const submitAdvanceSalaryRequest = async ({
  userId,
  userName,
  amount,
  reason,
  requestDate,
  expectedPaymentDate,
}) => {
  const colRef = collection(db, 'advance_requests');
  const payload = {
    userId,
    userName: userName || '',
    amount,
    reason,
    requestDate,
    expectedPaymentDate,
    status: 'pending',
    submittedAt: serverTimestamp(),
  };
  const docRef = await addDoc(colRef, payload);
  return { id: docRef.id, ...payload };
};

export const fetchPendingAdvanceRequests = async () => {
  const colRef = collection(db, 'advance_requests');
  const q = query(
    colRef,
    where('status', '==', 'pending'),
    orderBy('submittedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    requestType: 'advance',
  }));
};

export const updateAdvanceRequestStatus = async (
  id,
  status,
  managerNote = ''
) => {
  const ref = doc(db, 'advance_requests', id);
  await updateDoc(ref, { status, managerNote, decidedAt: serverTimestamp() });
};

export const fetchAdvanceRequestsByUser = async (userId) => {
  const colRef = collection(db, 'advance_requests');
  const q = query(colRef, where('userId', '==', userId));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => {
    const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
    const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
    return tb - ta;
  });
  return items;
};


