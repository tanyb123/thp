import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import * as path from 'path';
import { Readable } from 'stream';

const db = admin.firestore();

// Helper to build an authenticated Drive client
const getDriveClient = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../tanyb-fe4bf-4fbd5c01b6c7.json'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
};

/**
 * Callable Function: uploadFileToDrive
 * Uploads a base64 file to the "QC_Reports" subfolder of the project's Drive folder.
 * Returns the fileId and webViewLink.
 */
export const uploadFileToDrive = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn cần đăng nhập để sử dụng tính năng này.'
      );
    }

    const { projectId, fileName, mimeType, base64Data } = data as {
      projectId?: string;
      fileName?: string;
      mimeType?: string;
      base64Data?: string;
    };

    // Validate parameters
    if (!projectId || !fileName || !mimeType || !base64Data) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu tham số (projectId, fileName, mimeType hoặc base64Data)'
      );
    }

    try {
      const projectSnap = await db.collection('projects').doc(projectId).get();
      const projectData = projectSnap.data();

      if (!projectData || !projectData.driveFolderId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Không tìm thấy thư mục Drive của dự án.'
        );
      }

      const drive = await getDriveClient();

      // Step 1: Find or create QC_Reports subfolder
      const folderQuery = await drive.files.list({
        q: `name='QC_Reports' and '${projectData.driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      let qcFolderId: string | undefined;
      if (folderQuery.data.files && folderQuery.data.files.length > 0) {
        qcFolderId = folderQuery.data.files[0].id;
      } else {
        const folderRes = await drive.files.create({
          requestBody: {
            name: 'QC_Reports',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [projectData.driveFolderId],
          },
          fields: 'id',
        });
        qcFolderId = folderRes.data.id;
      }

      if (!qcFolderId) {
        throw new functions.https.HttpsError(
          'internal',
          'Không thể tạo hoặc tìm QC_Reports folder.'
        );
      }

      // Step 2: Upload file
      const buffer = Buffer.from(base64Data, 'base64');
      const stream = Readable.from(buffer);

      const createRes = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType,
          parents: [qcFolderId],
        },
        media: {
          mimeType,
          body: stream,
        },
        fields: 'id, webViewLink, thumbnailLink, mimeType, webContentLink',
      });

      const newFile = createRes.data;

      // Step 3: Set permissions
      await drive.permissions.create({
        fileId: newFile.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      return {
        success: true,
        fileId: newFile.id,
        webViewLink: newFile.webViewLink,
        thumbnailLink: newFile.thumbnailLink || newFile.webContentLink || '',
        mimeType: newFile.mimeType,
      };
    } catch (error: any) {
      console.error('Error uploading file to Drive:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Không thể tải lên file Google Drive.'
      );
    }
  });

/**
 * Callable Function: deleteFileFromDrive
 * Deletes a file on Google Drive by fileId.
 */
export const deleteFileFromDrive = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn cần đăng nhập.'
      );
    }

    const { fileId } = data as { fileId?: string };
    if (!fileId) {
      throw new functions.https.HttpsError('invalid-argument', 'Thiếu fileId.');
    }

    try {
      const drive = await getDriveClient();
      await drive.files.delete({ fileId });
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting file from Drive:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Không thể xóa file Google Drive.'
      );
    }
  });
