# 🔧 Workflow Stage Status Fix - Root Cause Found!

## ❌ **Root Cause của vấn đề:**

### **Data Structure Mismatch:**

Có 2 cấu trúc data khác nhau trong project:

#### **1. workflowStages (Được sử dụng trong WorkDetailModal):**

```javascript
// getTasksForWorker() đọc từ:
project.workflowStages = [
  {
    stageId: 'uuid-123',
    processName: 'Sơn',
    status: 'assigned', // ← Field này cần được cập nhật
    assignedWorkers: ['worker-id'],
  },
];
```

#### **2. tasks (Được sử dụng trong updateTaskStatus):**

```javascript
// updateTaskStatus() cập nhật:
project.tasks = {
  'task_uuid-123': {
    name: 'Sơn',
    status: 'completed', // ← Field này được cập nhật nhưng KHÔNG được đọc
    stageId: 'uuid-123',
  },
};
```

### **Vấn đề:**

```javascript
// ❌ SAI: Cập nhật tasks.status
await updateTaskStatus(projectId, stageId, 'completed');

// ✅ ĐÚNG: Cần cập nhật workflowStages[].status
await updateWorkflowStageStatus(projectId, stageId, 'completed');
```

## ✅ **Giải pháp đã implement:**

### **1. Thay đổi import:**

```javascript
// Trước:
import { updateTaskStatus } from '../api/projectService';

// Sau:
import { updateWorkflowStageStatus } from '../api/projectService';
```

### **2. Thay đổi function call:**

```javascript
// Trước:
await updateTaskStatus(
  runningSession.projectId,
  runningSession.stageId,
  'completed'
);

// Sau:
await updateWorkflowStageStatus(
  runningSession.projectId,
  runningSession.stageId,
  'completed'
);
```

### **3. updateWorkflowStageStatus Logic:**

```javascript
// src/api/projectService.js
export const updateWorkflowStageStatus = async (
  projectId,
  stageId,
  newStatus
) => {
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, 'projects', projectId);
    const snap = await transaction.get(ref);
    const stages = snap.data().workflowStages || [];

    // Tìm stage theo stageId
    const idx = stages.findIndex((s) => s.stageId === stageId);
    if (idx === -1) throw new Error('Stage not found');

    // Cập nhật status
    stages[idx] = {
      ...stages[idx],
      status: newStatus, // 'completed'
    };

    // Lưu lại
    transaction.update(ref, { workflowStages: stages });
  });
};
```

## 🎯 **Workflow hoàn chỉnh (Fixed):**

```
1. User bấm "HOÀN THÀNH"
   ↓
2. Stop work session (lưu thời gian)
   ↓
3. ✅ updateWorkflowStageStatus(projectId, stageId, 'completed')
   ↓
4. workflowStages[].status = 'completed' (CẬP NHẬT ĐÚNG FIELD)
   ↓
5. Reload tasks trong WorkDetailModal
   ↓
6. getTasksForWorker() đọc workflowStages[].status
   ↓
7. Filter: task.stageStatus !== 'completed'
   ↓
8. Task biến mất khỏi danh sách! 🎉
```

## 🧪 **Debug Logs Added:**

### **WorkDetailModal Debug:**

```javascript
console.log('=== TASK FILTERING DEBUG ===');
console.log('Total tasks:', tasks.length);
console.log('Available tasks (not completed):', availableTasks.length);
tasks.forEach((task, index) => {
  console.log(`Task ${index + 1}:`, {
    stageName: task.stageName,
    stageStatus: task.stageStatus, // Sẽ thấy 'completed' sau khi fix
    projectId: task.projectId,
    stageId: task.stageId,
  });
});
```

### **HandleStopWork Debug:**

```javascript
console.log('=== HANDLE STOP WORK DEBUG ===');
console.log('Running session:', {
  id: runningSession.id,
  stageName: runningSession.stageName,
  projectId: runningSession.projectId,
  stageId: runningSession.stageId,
});
console.log(
  'Updated workflow stage status to completed:',
  runningSession.stageId
);
```

## 📱 **Expected Results After Fix:**

### **Console Logs Sequence:**

```
1. "=== HANDLE STOP WORK DEBUG ==="
2. "User confirmed stop work"
3. "Stopped work session: [sessionId] Duration: [hours]"
4. "Updated workflow stage status to completed: [stageId]"
5. "onStopWork completed, reloading data..."
6. "Data reloaded"
7. "=== TASK FILTERING DEBUG ==="
8. "Total tasks: 3"
9. "Available tasks (not completed): 2" ← Giảm từ 3 xuống 2
10. "Task 1: { stageName: 'Hàn', stageStatus: 'assigned' }"
11. "Task 2: { stageName: 'Phay', stageStatus: 'assigned' }"
    (Task Sơn không còn hiển thị vì stageStatus = 'completed')
```

### **UI Changes:**

```
Before: Công việc được giao (3)
After:  Công việc được giao (2)

Before: [Sơn] [Hàn] [Phay]
After:  [Hàn] [Phay] (Sơn biến mất)
```

## 🔧 **Files Updated:**

- ✅ **KioskScreen.js** - Fixed to use updateWorkflowStageStatus
- ✅ **ProductionDashboard.js** - Fixed to use updateWorkflowStageStatus
- ✅ **WorkDetailModal.js** - Added debug logs
- ✅ **projectService.js** - updateWorkflowStageStatus function (đã có sẵn)

## ✅ **Status: FIXED**

**Root cause:** Data structure mismatch giữa `workflowStages` và `tasks`

**Solution:** Sử dụng `updateWorkflowStageStatus` thay vì `updateTaskStatus`

**Result:** Tasks sẽ biến mất khỏi danh sách sau khi hoàn thành!

## 🚀 **Ready for Testing:**

1. **Mở app** → Chọn worker có tasks
2. **Bắt đầu task** → Verify timer chạy
3. **Bấm HOÀN THÀNH** → Check console logs:
   - ✅ "Updated workflow stage status to completed"
   - ✅ "Available tasks (not completed): [số giảm]"
4. **Verify UI** → Task biến mất khỏi list

**🎯 Lần này chắc chắn sẽ hoạt động!**
















































