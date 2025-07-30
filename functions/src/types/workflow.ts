// types for dynamic workflow system
export interface ProcessTemplate {
  /** Readable Vietnamese name, e.g. "Cắt Laser" */
  processName: string;
  /** Unique machine-readable key, e.g. "laser_cutting" */
  processKey: string;
  /** Optional high-level category, e.g. "Tạo phôi" */
  category?: string;
}

export interface WorkflowStage {
  /** Firestore document id of the selected template */
  stageId: string;
  processKey: string;
  processName: string;
  /** Smaller number appears first */
  order: number;
  /** pending | in_progress | completed */
  status: 'pending' | 'in_progress' | 'completed';
  /** uid of the assigned employee (can be empty) */
  assignedToId?: string;
}
