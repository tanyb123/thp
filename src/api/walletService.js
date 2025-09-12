import { db } from '../config/firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

// Collections
const WALLETS = 'wallets'; // { name, balance, createdAt, updatedAt }
const WALLET_LEDGER = 'wallet_ledger'; // { walletId, amount, type: 'in'|'out', refId, note, createdBy, createdAt }
const WALLET_REQUESTS = 'wallet_requests'; // { walletId, amount, reason, status: pending|approved|rejected, requestedBy, approvedBy, createdAt, updatedAt }

export const createWallet = async ({ name }) => {
  const ref = await addDoc(collection(db, WALLETS), {
    name,
    balance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const listWallets = async () => {
  const snap = await getDocs(
    query(collection(db, WALLETS), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const getWallet = async (id) => {
  const d = await getDoc(doc(db, WALLETS, id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
};

export const updateWalletName = async (id, name) => {
  await updateDoc(doc(db, WALLETS, id), { name, updatedAt: serverTimestamp() });
};

export const deleteWallet = async ({ walletId, cascade = false }) => {
  if (cascade) {
    const qy = query(
      collection(db, WALLET_LEDGER),
      where('walletId', '==', walletId)
    );
    const snap = await getDocs(qy);
    const deletions = [];
    snap.forEach((d) =>
      deletions.push(deleteDoc(doc(db, WALLET_LEDGER, d.id)))
    );
    await Promise.all(deletions);
  }
  await deleteDoc(doc(db, WALLETS, walletId));
};

export const addLedger = async ({
  walletId,
  amount,
  type,
  refId,
  note,
  createdBy,
}) => {
  const amt = Number(amount) || 0;
  await addDoc(collection(db, WALLET_LEDGER), {
    walletId,
    amount: amt,
    type,
    refId: refId || null,
    note: note || '',
    createdBy: createdBy || null,
    createdAt: serverTimestamp(),
  });
  const wRef = doc(db, WALLETS, walletId);
  const wSnap = await getDoc(wRef);
  const curr = Number(wSnap.data()?.balance || 0);
  const delta = type === 'in' ? amt : -amt;
  await updateDoc(wRef, {
    balance: curr + delta,
    updatedAt: serverTimestamp(),
  });
};

export const listLedger = async (walletId) => {
  const qy = query(
    collection(db, WALLET_LEDGER),
    where('walletId', '==', walletId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Requests
export const createCashInRequest = async ({
  walletId,
  amount,
  reason,
  requestedBy,
}) => {
  const ref = await addDoc(collection(db, WALLET_REQUESTS), {
    walletId,
    amount: Number(amount) || 0,
    reason: reason || '',
    status: 'pending',
    requestedBy,
    approvedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const listCashInRequests = async ({ status } = {}) => {
  const snap = await getDocs(
    query(collection(db, WALLET_REQUESTS), orderBy('createdAt', 'desc'))
  );
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (status) items = items.filter((i) => (i.status || 'pending') === status);
  return items;
};

export const approveCashInRequest = async ({ requestId, approverId }) => {
  const rRef = doc(db, WALLET_REQUESTS, requestId);
  const rSnap = await getDoc(rRef);
  if (!rSnap.exists()) return;
  const r = rSnap.data();
  if (r.status === 'approved') return; // idempotent
  await updateDoc(rRef, {
    status: 'approved',
    approvedBy: approverId || null,
    updatedAt: serverTimestamp(),
  });
  await addLedger({
    walletId: r.walletId,
    amount: r.amount,
    type: 'in',
    refId: requestId,
    note: r.reason,
    createdBy: r.requestedBy,
  });
};

export const rejectCashInRequest = async ({ requestId, approverId }) => {
  await updateDoc(doc(db, WALLET_REQUESTS, requestId), {
    status: 'rejected',
    approvedBy: approverId || null,
    updatedAt: serverTimestamp(),
  });
};

// Utility: deduct when an expense gets approved
export const deductForExpense = async ({
  walletId,
  amount,
  expenseId,
  note,
  actorId,
}) => {
  await addLedger({
    walletId,
    amount: Number(amount) || 0,
    type: 'out',
    refId: expenseId,
    note: note || 'Chi tiền',
    createdBy: actorId || null,
  });
};

export default {
  createWallet,
  listWallets,
  getWallet,
  updateWalletName,
  addLedger,
  listLedger,
  createCashInRequest,
  listCashInRequests,
  approveCashInRequest,
  rejectCashInRequest,
  deductForExpense,
  deleteWallet,
};
