//functions/src/taskTriggers.ts
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// --- Helper Functions ---

/**
 * Fetches users from Firestore based on their role.
 * @param {string | string[]} roles The role or roles to query for.
 * @returns {Promise<any[]>} An array of user objects.
 */
const getUsersByRole = async (roles: string | string[]): Promise<any[]> => {
  const rolesArray = Array.isArray(roles) ? roles : [roles];
  if (rolesArray.length === 0) return [];
  try {
    const usersRef = db.collection('users');
    // Firestore "in" query supports up to 10 elements. If more are needed,
    // multiple queries would be required. For now, this is sufficient.
    const querySnapshot = await usersRef.where('role', 'in', rolesArray).get();
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching users by role: ${roles}`, error);
    return [];
  }
};

/**
 * Sends a push notification to a list of users.
 * @param {any[]} users An array of user objects, must include fcmToken.
 * @param {string} title The notification title.
 * @param {string} body The notification body.
 * @returns {Promise<any>} A promise that resolves when all messages are sent.
 */
const sendNotificationToUsers = (
  users: any[],
  title: string,
  body: string
): Promise<any> => {
  const tokens = users.map((user) => user.fcmToken).filter((token) => token); // Filter out users without tokens

  if (tokens.length === 0) {
    return Promise.resolve();
  }
  // FCM"s sendToDevice supports up to 1000 tokens.
  return admin.messaging().sendToDevice(tokens, {
    notification: { title, body, sound: 'default' },
  });
};

/**
 * Fetches a user"s display name from their UID.
 * @param {string} uid The user"s ID.
 * @returns {Promise<string>} The user"s name or a fallback string.
 */
const getUserName = async (uid: string): Promise<string> => {
  if (!uid) return 'Hệ thống';
  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord.displayName || userRecord.email || 'Người dùng không tên';
  } catch (error) {
    console.error(`Error fetching user data for UID: ${uid}`, error);
    return 'Người dùng không tồn tại';
  }
};

/**
 * Gets the human-readable label for a task key.
 * @param {string} taskKey The key of the task (e.g., "material_cutting").
 * @param {any} taskData The data object for the task, used for custom task names.
 * @returns {string} The display label for the task.
 */
const getTaskLabel = (taskKey: string, taskData: any): string => {
  const taskLabels: { [key: string]: string } = {
    material_separation: 'Bóc tách vật tư',
    quotation: 'Báo giá',
    material_purchasing: 'Mua vật tư',
    material_cutting: 'Cắt phôi',
    assembly: 'Lắp ráp',
    painting: 'Sơn',
    shipping: 'Vận chuyển',
    turning: 'Tiện',
    milling: 'Phay',
    welding: 'Hàn',
    bending: 'Chấn',
    drilling: 'Khoan',
    grinding: 'Mài',
    other: taskData?.name || 'Công việc khác',
  };
  return taskLabels[taskKey] || 'Công việc không xác định';
};

/**
 * Denormalizes a single task into the top-level "tasks" collection.
 * @param {string} projectId The project ID.
 * @param {string} projectName The project name.
 * @param {string} projectStatus The project status.
 * @param {string} taskKey The key of the task.
 * @param {any} taskData The data of the task.
 * @returns {Promise<any>} A promise that resolves when the write is complete.
 */
const denormalizeTask = async (
  projectId: string,
  projectName: string,
  projectStatus: string,
  taskKey: string,
  taskData: any
) => {
  const assignedToId = taskData.assignedTo || null;
  const assignedToName = await getUserName(assignedToId);
  const denormalizedTask = {
    projectId,
    projectName,
    projectStatus,
    taskKey,
    taskLabel: getTaskLabel(taskKey, taskData),
    status: taskData.status || 'pending',
    assignedToId,
    assignedToName,
    startDate: taskData.startDate || null,
    endDate: taskData.endDate || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const docId = `${projectId}_${taskKey}`;
  return db
    .collection('tasks')
    .doc(docId)
    .set(denormalizedTask, { merge: true });
};

// --- Main Cloud Function Trigger ---

export const projectWorkflowManager = onDocumentWritten(
  {
    document: 'projects/{projectId}',
    region: 'asia-southeast1',
  },
  async (event) => {
    const { projectId } = event.params;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!afterData) {
      console.log(`Project ${projectId} deleted. No action taken.`);
      return null;
    }

    const projectName = afterData.name || 'Dự án không tên';
    const updates: { [key: string]: any } = {};
    const notificationPromises: Promise<any>[] = [];

    // --- Workflow Triggers ---

    // Trigger 1: Project Creation
    if (!beforeData) {
      const engineers = await getUsersByRole('ky_su');
      if (engineers.length > 0) {
        const engineerToAssign = engineers[0];
        updates['tasks.material_separation.assignedTo'] = engineerToAssign.id;
        notificationPromises.push(
          sendNotificationToUsers(
            [engineerToAssign],
            'Nhiệm vụ mới',
            `Bạn được giao nhiệm vụ "Tách vật liệu" cho dự án mới: ${projectName}.`
          )
        );
      }
    }

    // ---- NEW WORKFLOW LOGIC ----
    const beforeStages: any[] = beforeData?.workflowStages || [];
    const afterStages: any[] = afterData.workflowStages || [];

    // Detect status change to completed for material_separation
    const justCompleted = afterStages.find((stageAfter) => {
      if (stageAfter.processKey !== 'material_separation') return false;
      const beforeStage = beforeStages.find(
        (s) => s.stageId === stageAfter.stageId
      );
      return (
        beforeStage?.status !== 'completed' && stageAfter.status === 'completed'
      );
    });

    if (justCompleted) {
      // Find next stage by order
      const nextStage = afterStages
        .filter((s) => s.order > justCompleted.order)
        .sort((a, b) => a.order - b.order)[0];

      if (nextStage && nextStage.processKey === 'quotation') {
        const usersToNotify = await getUsersByRole(['thuong_mai', 'giam_doc']);
        const salesUser = usersToNotify.find((u) => u.role === 'thuong_mai');

        if (salesUser) {
          // update array element
          const newStages = afterStages.map((s) =>
            s.stageId === nextStage.stageId
              ? { ...s, assignedToId: salesUser.id }
              : s
          );
          updates['workflowStages'] = newStages;
        }

        notificationPromises.push(
          sendNotificationToUsers(
            usersToNotify,
            'Yêu cầu báo giá',
            `Kỹ sư đã hoàn thành bóc tách vật liệu cho dự án ${projectName}. Vui lòng tiến hành báo giá.`
          )
        );
      }
    }

    // Trigger 3: Project Approved -> Assign Purchasing & Cutting
    if (
      beforeData?.status === 'pending' &&
      afterData.status === 'in-progress'
    ) {
      // a. Assign Material Purchasing
      const purchasingUsers = await getUsersByRole(['thuong_mai', 'ke_toan']);
      const salesUser = purchasingUsers.find((u) => u.role === 'thuong_mai');
      if (salesUser) {
        updates['tasks.material_purchasing.assignedTo'] = salesUser.id;
      }
      notificationPromises.push(
        sendNotificationToUsers(
          purchasingUsers,
          'Yêu cầu mua vật tư',
          `Dự án ${projectName} đã được duyệt. Vui lòng tiến hành mua vật tư.`
        )
      );

      // b. Assign Material Cutting
      const cuttingEngineers = await getUsersByRole('ky_su_cat_phoi');
      if (cuttingEngineers.length > 0) {
        const engineerToAssign = cuttingEngineers[0];
        updates['tasks.material_cutting.assignedTo'] = engineerToAssign.id;
        notificationPromises.push(
          sendNotificationToUsers(
            [engineerToAssign],
            'Nhiệm vụ mới',
            `Bạn được giao nhiệm vụ "Cắt phôi" cho dự án ${projectName}.`
          )
        );
      }
    }

    // Trigger 4: Material Cutting Completed -> Assign Assembly & Painting
    if (
      beforeData?.tasks.material_cutting?.status !== 'completed' &&
      afterData.tasks.material_cutting?.status === 'completed'
    ) {
      const viceDirectors = await getUsersByRole('pho_giam_doc');
      if (viceDirectors.length > 0) {
        const userToAssign = viceDirectors[0];
        updates['tasks.assembly.assignedTo'] = userToAssign.id;
        updates['tasks.painting.assignedTo'] = userToAssign.id;
        notificationPromises.push(
          sendNotificationToUsers(
            viceDirectors,
            'Yêu cầu giám sát',
            `Công đoạn Cắt phôi đã xong. Vui lòng giám sát và thực hiện Lắp ráp & Sơn cho dự án ${projectName}.`
          )
        );
      }
    }

    // Trigger 5: Assembly & Painting Completed -> Assign Shipping
    if (
      afterData.tasks.assembly?.status === 'completed' &&
      afterData.tasks.painting?.status === 'completed' &&
      (beforeData?.tasks.assembly?.status !== 'completed' ||
        beforeData?.tasks.painting?.status !== 'completed')
    ) {
      const usersToNotify = await getUsersByRole(['ke_toan', 'pho_giam_doc']);
      const accountant = usersToNotify.find((u) => u.role === 'ke_toan');

      if (accountant) {
        updates['tasks.shipping.assignedTo'] = accountant.id;
      }
      notificationPromises.push(
        sendNotificationToUsers(
          usersToNotify,
          'Yêu cầu vận chuyển',
          `Dự án ${projectName} đã sẵn sàng. Vui lòng sắp xếp vận chuyển.`
        )
      );
    }

    // --- Denormalization Logic (runs on any task change) ---
    const denormalizationPromises: Promise<any>[] = [];
    const beforeTasks = beforeData?.tasks || {};
    const afterTasks = afterData.tasks || {};

    for (const taskKey in afterTasks) {
      if (
        Object.prototype.hasOwnProperty.call(afterTasks, taskKey) &&
        JSON.stringify(beforeTasks[taskKey]) !==
          JSON.stringify(afterTasks[taskKey])
      ) {
        denormalizationPromises.push(
          denormalizeTask(
            projectId,
            projectName,
            afterData.status,
            taskKey,
            afterTasks[taskKey]
          )
        );
      }
    }

    // --- Execute Updates and Notifications ---
    const allPromises: Promise<any>[] = [
      ...notificationPromises,
      ...denormalizationPromises,
    ];

    if (Object.keys(updates).length > 0 && event.data) {
      // Add timestamp to avoid recursive triggers for the same update
      updates['workflowUpdatedAt'] =
        admin.firestore.FieldValue.serverTimestamp();
      allPromises.push(event.data.after.ref.update(updates));
    }

    return Promise.all(allPromises);
  }
);
