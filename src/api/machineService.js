import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

class MachineService {
  constructor() {
    this.db = db;
    this.colName = 'machines';
    this.maintCol = 'machine_maintenances';
    this.logCol = 'machine_logs';
    this.incidentCol = 'machine_incidents';
  }

  async listMachines(filters = {}) {
    try {
      const { keyword, status } = filters;
      let q = query(
        collection(this.db, this.colName),
        orderBy('createdAt', 'desc')
      );

      // Firestore không hỗ trợ contains cho nhiều field, nên filter keyword ở client
      const snap = await getDocs(q);
      let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (status)
        items = items.filter(
          (m) => (m.status || '').toLowerCase() === status.toLowerCase()
        );
      if (keyword && keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        items = items.filter((m) =>
          [m.code, m.name, m.location, m.vendor, m.model]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(k))
        );
      }
      return items;
    } catch (e) {
      console.error('listMachines error', e);
      return [];
    }
  }

  async getMachine(id) {
    const ref = doc(this.db, this.colName, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  }

  async createMachine(payload) {
    const ref = await addDoc(collection(this.db, this.colName), {
      code: payload.code || '',
      name: payload.name || '',
      model: payload.model || '',
      vendor: payload.vendor || '',
      location: payload.location || '',
      status: payload.status || 'active', // active | maintenance | broken | retired
      lastMaintenanceAt: payload.lastMaintenanceAt || null,
      nextMaintenanceAt: payload.nextMaintenanceAt || null,
      notes: payload.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id };
  }

  async updateMachine(id, payload) {
    const ref = doc(this.db, this.colName, id);
    await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
  }

  async deleteMachine(id) {
    const ref = doc(this.db, this.colName, id);
    await deleteDoc(ref);
  }

  // ========== Maintenance schedule ==========
  async listMaintenance(machineId, { fromDate, toDate } = {}) {
    let q = query(
      collection(this.db, this.maintCol),
      where('machineId', '==', machineId),
      orderBy('scheduledAt', 'desc')
    );
    const snap = await getDocs(q);
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (fromDate || toDate) {
      const fromMs = fromDate ? new Date(fromDate).getTime() : 0;
      const toMs = toDate
        ? new Date(toDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      items = items.filter((i) => {
        const t =
          (i.scheduledAt?.toDate?.() || new Date(i.scheduledAt)).getTime?.() ||
          0;
        return t >= fromMs && t <= toMs;
      });
    }
    return items;
  }

  async createMaintenance(payload) {
    const ref = await addDoc(collection(this.db, this.maintCol), {
      machineId: payload.machineId,
      title: payload.title || 'Bảo trì định kỳ',
      description: payload.description || '',
      scheduledAt: payload.scheduledAt || null, // Timestamp | ISO string
      assigneeId: payload.assigneeId || null,
      status: payload.status || 'scheduled', // scheduled | in_progress | done | skipped
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id };
  }

  async updateMaintenance(id, payload) {
    const ref = doc(this.db, this.maintCol, id);
    await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
  }

  async deleteMaintenance(id) {
    const ref = doc(this.db, this.maintCol, id);
    await deleteDoc(ref);
  }

  // ========== Maintenance logs ==========
  async listLogs(machineId) {
    const qy = query(
      collection(this.db, this.logCol),
      where('machineId', '==', machineId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(qy);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async addLog(payload) {
    const ref = await addDoc(collection(this.db, this.logCol), {
      machineId: payload.machineId,
      type: payload.type || 'maintenance', // maintenance | repair | part_replacement
      note: payload.note || '',
      cost: Number(payload.cost) || 0,
      parts: payload.parts || [], // [{name, qty, cost}]
      performedAt: payload.performedAt || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      performedBy: payload.performedBy || null,
      attachmentUrls: payload.attachmentUrls || [],
    });
    return { id: ref.id };
  }

  async updateLog(id, payload) {
    const ref = doc(this.db, this.logCol, id);
    await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
  }

  async deleteLog(id) {
    const ref = doc(this.db, this.logCol, id);
    await deleteDoc(ref);
  }

  // ========== Incidents ==========
  async listIncidents(machineId, { status } = {}) {
    let qy = query(
      collection(this.db, this.incidentCol),
      where('machineId', '==', machineId),
      orderBy('reportedAt', 'desc')
    );
    const snap = await getDocs(qy);
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (status) items = items.filter((i) => (i.status || '') === status);
    return items;
  }

  async reportIncident(payload) {
    const ref = await addDoc(collection(this.db, this.incidentCol), {
      machineId: payload.machineId,
      title: payload.title || 'Sự cố máy',
      description: payload.description || '',
      severity: payload.severity || 'medium', // low | medium | high | critical
      status: payload.status || 'open', // open | assigned | in_progress | resolved | closed
      reportedBy: payload.reportedBy || null,
      assigneeId: payload.assigneeId || null,
      reportedAt: payload.reportedAt || serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id };
  }

  async updateIncident(id, payload) {
    const ref = doc(this.db, this.incidentCol, id);
    await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() });
  }

  async deleteIncident(id) {
    const ref = doc(this.db, this.incidentCol, id);
    await deleteDoc(ref);
  }
}

export default new MachineService();


