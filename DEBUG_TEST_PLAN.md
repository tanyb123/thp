# 🔍 Debug Test Plan - Dual Issues

## 🎯 **Two Issues to Debug:**

### **Issue 1: Task Completion Not Persisting**

- ✅ Optimistic updates work in modal
- ❌ Server sync may be failing
- ❌ StageDetail still shows "Chờ xử lý" instead of "Hoàn thành"

### **Issue 2: Stage Navigation Error**

- ❌ Error when clicking on any stage in "Quy trình Sản xuất"
- ❌ Error message mentions "inventory" and "family"

## 🧪 **Test Plan:**

### **Test 1: Task Completion Debug**

#### **Step 1: Complete a Task**

1. ✅ Open app → Select worker with tasks
2. ✅ Start a task → Click "HOÀN THÀNH"
3. ✅ **Watch console logs carefully:**

```
Expected Console Output:
1. "User confirmed stop work"
2. "Applying optimistic updates..."
3. "🚀 Task completed optimistically: [stageId] for worker: [workerId]"
4. "🔄 Starting server sync..." + runningSession details
5. "🔄 Updating workflow stage status..." + projectId/stageId
6. "🔄 updateWorkflowStageStatus called:" + parameters
7. "⚠️ Direct update failed, using transaction fallback:" + error
8. "📋 Current stages:" + all stages with status
9. "🎯 Found stage at index X:" + stage details
10. "💾 Updating stage to:" + updated stage
11. "✅ Transaction update completed"
12. "✅ Updated workflow stage status to completed"
13. "✅ Server sync completed successfully"
```

#### **Step 2: Check for Errors**

Look for these specific error patterns:

**A. StageId Mismatch:**

```
❌ Stage not found: [stageId]
Available stageIds: [list]
```

**B. Missing Data:**

```
❌ Missing projectId or stageId: {...}
```

**C. Server Sync Failure:**

```
❌ Server sync failed: [error details]
🔄 Rolling back optimistic updates due to server error
```

#### **Step 3: Verify Persistence**

1. ✅ Go to "Quy trình Sản xuất"
2. ✅ Find the completed task
3. ✅ Check if status shows "Hoàn thành" or still "Chờ xử lý"

### **Test 2: Stage Navigation Debug**

#### **Step 1: Navigate to Stage**

1. ✅ Go to "Quy trình Sản xuất"
2. ✅ Click on any stage (e.g., "Sơn (Painting)")
3. ✅ **Watch console logs:**

```
Expected Console Output:
1. "🎯 Stage pressed:" + stage details
2. "🎯 StageDetailScreen mounted with params:" + params
3. "🔄 Fetching project data for:" + projectId
4. "✅ Project data loaded:" + project summary
```

#### **Step 2: Check for Errors**

Look for these error patterns:

**A. Navigation Error:**

```
❌ Navigation error: [error details]
```

**B. Missing Stage Data:**

```
❌ No stage data provided to StageDetailScreen
```

**C. Project Fetch Error:**

```
❌ Error fetching project details: [error details]
❌ No projectId provided
```

**D. Inventory/Family Error:**

```
[Look for any error mentioning "inventory" or "family"]
```

## 📋 **Data Collection:**

### **For Issue 1 (Task Completion):**

Please provide:

1. ✅ **Complete console logs** from task completion
2. ✅ **StageId values** from logs
3. ✅ **Available stageIds** if "Stage not found" error
4. ✅ **Final status** in StageDetail screen

### **For Issue 2 (Stage Navigation):**

Please provide:

1. ✅ **Complete error message** (screenshot if needed)
2. ✅ **Console logs** from stage click
3. ✅ **Stage data** from "🎯 Stage pressed" log
4. ✅ **Any stack trace** if available

## 🎯 **Expected Outcomes:**

### **Scenario A: StageId Mismatch**

```
Console: "❌ Stage not found: abc-123"
Console: "Available stageIds: ['def-456', 'ghi-789']"
→ Solution: Fix stageId mapping between runningSession and workflowStages
```

### **Scenario B: Transaction Failure**

```
Console: "❌ Server sync failed: [permission/network error]"
→ Solution: Fix Firestore permissions or network handling
```

### **Scenario C: Navigation Data Issue**

```
Console: "❌ No stage data provided to StageDetailScreen"
→ Solution: Fix stage data passing in navigation
```

### **Scenario D: Project Service Error**

```
Console: "❌ Error fetching project details: [specific error]"
→ Solution: Fix getProjectById function or data structure
```

## 🚀 **Next Steps:**

1. **Run both tests** and collect console logs
2. **Identify the specific error pattern** from above scenarios
3. **Provide logs** for targeted debugging
4. **Apply specific fix** based on error pattern

**🎯 With these debug logs, we'll pinpoint the exact root cause and fix both issues!** 🔍





























































































