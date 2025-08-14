import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getDriveClient } from './utils/driveClient';
import { APP_DRIVE_ROOT_FOLDER_ID } from './config';

const db = admin.firestore();

/**
 * Callable: createProjectFolders
 * - Input: { projectId: string }
 * - Creates a Drive folder for the project inside the app root and
 *   sub-folders [baogia, hopdong, PO, QC_Reports].
 * - Saves driveFolderId, driveFolderUrl back to Firestore.
 */
export const createProjectFolders = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn cần đăng nhập.'
      );
    }

    const { projectId } = data as { projectId?: string };
    if (!projectId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu projectId'
      );
    }

    const projectRef = db.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Không tìm thấy dự án');
    }

    const projectData = projectSnap.data()!;
    if (projectData.driveFolderId) {
      // Folder đã tồn tại, trả về ngay
      return {
        success: true,
        driveFolderId: projectData.driveFolderId,
        driveFolderUrl: projectData.driveFolderUrl,
        skipped: true,
      };
    }

    try {
      const drive = await getDriveClient();

      // Sanitize name (không ký tự đặc biệt mà Drive cấm)
      const cleanName = (projectData.name || projectId).replace(
        /[\\/:*?"<>|]/g,
        '_'
      );

      // 1. Tạo thư mục dự án bên trong ROOT
      const projectFolderRes = await drive.files.create({
        requestBody: {
          name: cleanName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [APP_DRIVE_ROOT_FOLDER_ID],
        },
        fields: 'id, webViewLink',
      });

      const projectFolderId = projectFolderRes.data.id!;

      // 2. Tạo sub-folders
      const subNames = [
        'baogia',
        'hopdong',
        'PO',
        'QC_Reports',
        'Tài liệu',
        'Thống kê vật tư',
      ];
      await Promise.all(
        subNames.map((sub) =>
          drive.files.create({
            requestBody: {
              name: sub,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [projectFolderId],
            },
          })
        )
      );

      // 3. Ghi Firestore
      await projectRef.update({
        driveFolderId: projectFolderId,
        driveFolderUrl: projectFolderRes.data.webViewLink,
        driveCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        driveFolderId: projectFolderId,
        driveFolderUrl: projectFolderRes.data.webViewLink,
        skipped: false,
      };
    } catch (err: any) {
      console.error('createProjectFolders error:', err);
      throw new functions.https.HttpsError(
        'internal',
        err.message || 'Lỗi tạo thư mục dự án'
      );
    }
  });
