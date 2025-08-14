# 🔍 Task Completion Debug Guide

## 🎯 **Problem:**

- Kiosk task completion không update StageDetail status
- Task vẫn hiển thị "Chờ xử lý" thay vì "Hoàn thành"
- Server sync có thể fail hoặc stageId mismatch

## 🧪 **Debug Test Plan:**

### **Step 1: Complete a Task with Enhanced Logs**

1. ✅ Open Kiosk → Select worker with running task
2. ✅ Click "HOÀN THÀNH"
3. ✅ **Watch console logs carefully for:**

#### **A. Task Data Verification:**

```
🎯 Completing task with stageId: [stageId]
📋 Current tasks before filter: [array of tasks with stageIds]
📋 Tasks after filter: [filtered array]
```

#### **B. RunningSession Data:**

```
🔍 Full runningSession data: {
  id: "session_id",
  projectId: "project_id",
  stageId: "stage_id",      // ← Key field to verify
  stageName: "stage_name"
}
🔍 StageId type: "string"   // ← Should be string
```

#### **C. Server Sync Process:**

```
🔄 updateWorkflowStageStatus called: {
  projectId: "project_id",
  stageId: "stage_id",      // ← Must match runningSession.stageId
  newStatus: "completed"
}

🔍 Looking for stageId: "stage_id"
🔍 Available stageIds: ["id1", "id2", "id3"]  // ← Check if match exists
🔍 StageId type: "string"
🔍 Available stageId types: ["string", "string"]

🎯 Found stage at index: 0  // ← Should be >= 0, not -1
```

#### **D. Success or Failure:**

```
✅ SUCCESS:
💾 Updating stage to: {stageId: "...", status: "completed"}
✅ Transaction update completed
✅ Server sync completed successfully

❌ FAILURE:
❌ Stage not found: "stage_id"
Available stageIds: ["different_id1", "different_id2"]
```

### **Step 2: Identify the Issue Pattern**

#### **Pattern A: StageId Mismatch (Most Likely)**

```
🔍 Looking for stageId: "abc-123-def"
🔍 Available stageIds: ["xyz-456-ghi", "uvw-789-jkl"]
❌ Stage not found: "abc-123-def"
```

**Root Cause:** runningSession.stageId ≠ workflowStages[].stageId
**Solution:** Fix stageId mapping in work session creation

#### **Pattern B: Type Mismatch**

```
🔍 StageId type: "string"
🔍 Available stageId types: ["number", "number"]
```

**Root Cause:** Data type inconsistency
**Solution:** Ensure consistent string types

#### **Pattern C: Transaction Failure**

```
✅ Found stage at index: 0
💾 Updating stage to: {...}
❌ Server sync failed: [permission/network error]
```

**Root Cause:** Firestore permission or network issue
**Solution:** Fix Firestore rules or error handling

#### **Pattern D: Cache Issue**

```
✅ All logs successful
✅ Server sync completed successfully
But StageDetail still shows "Chờ xử lý"
```

**Root Cause:** StageDetail reading from cache
**Solution:** Force refresh or fix cache invalidation

### **Step 3: Verify StageDetail Data**

1. ✅ After task completion, go to "Quy trình Sản xuất"
2. ✅ Click on the completed stage
3. ✅ **Check console logs:**

```
🎯 StageDetailScreen mounted with params: {
  stage: {
    stageId: "stage_id",     // ← Should match completed task
    status: "completed"      // ← Should be "completed", not "assigned"
  }
}

✅ Project data loaded: {
  workflowStagesCount: X
}
```

### **Step 4: Cross-Reference Data**

Compare these values across the flow:

| Source                   | StageId                      | Status                          |
| ------------------------ | ---------------------------- | ------------------------------- |
| runningSession.stageId   | `abc-123`                    | -                               |
| workflowStages[].stageId | `abc-123` ✅ or `xyz-456` ❌ | `assigned` → `completed`        |
| StageDetail params       | `abc-123`                    | `completed` ✅ or `assigned` ❌ |

## 🎯 **Expected Debug Outcomes:**

### **Scenario 1: StageId Mismatch (90% probability)**

```
runningSession.stageId: "d7febbe9-ce86-4618-a1dc-6c5360d716e4"
workflowStages stageIds: ["different-uuid-1", "different-uuid-2"]
→ Fix: Ensure work session uses correct stageId from workflowStages
```

### **Scenario 2: Server Update Success but Cache Issue**

```
✅ Transaction update completed
✅ Server sync completed successfully
But StageDetail shows old status
→ Fix: Force refresh StageDetail data or fix cache
```

### **Scenario 3: Permission/Network Failure**

```
❌ Server sync failed: Permission denied / Network error
→ Fix: Firestore rules or network handling
```

## 🚀 **Next Steps:**

1. **Run the test** and collect all console logs
2. **Identify the pattern** from scenarios above
3. **Apply targeted fix** based on the specific issue
4. **Verify fix** by completing another task

## 📋 **Data to Collect:**

Please provide:

1. ✅ **Complete console logs** from task completion
2. ✅ **StageId values** from all debug points
3. ✅ **Success/failure status** of server sync
4. ✅ **StageDetail status** after completion

**🎯 With these enhanced debug logs, we'll pinpoint the exact issue and fix it!** 🔍
















































