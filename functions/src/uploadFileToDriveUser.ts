import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { Readable } from 'stream';

const db = admin.firestore();

export const uploadFileToDriveUser = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const { accessToken, projectId, fileName, mimeType, base64Data } = data as {
      accessToken?: string;
      projectId?: string;
      fileName?: string;
      mimeType?: string;
      base64Data?: string;
    };

    console.log(
      `[uploadFileToDriveUser] Starting upload for project ${projectId}, file: ${fileName}`
    );

    if (!accessToken) {
      console.error('[uploadFileToDriveUser] Missing accessToken');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Thiếu accessToken'
      );
    }
    if (!projectId || !fileName || !mimeType || !base64Data) {
      console.error('[uploadFileToDriveUser] Missing required parameters');
      throw new functions.https.HttpsError('invalid-argument', 'Thiếu tham số');
    }

    try {
      const projectSnap = await db.collection('projects').doc(projectId).get();
      const projectData = projectSnap.data();
      if (!projectData || !projectData.driveFolderId) {
        console.error(
          `[uploadFileToDriveUser] Project folder not found for project ${projectId}`
        );
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Không tìm thấy thư mục Drive của dự án.'
        );
      }

      console.log(
        `[uploadFileToDriveUser] Found project folder ID: ${projectData.driveFolderId}`
      );
      console.log(
        `[uploadFileToDriveUser] Project name: ${projectData.name || 'Unknown'}`
      );
      console.log(
        `[uploadFileToDriveUser] Project code: ${projectData.code || 'Unknown'}`
      );

      // Build Drive client with user's OAuth token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      // Verify access token works by getting user info
      try {
        console.log(`[uploadFileToDriveUser] Verifying access token validity`);
        const aboutResponse = await drive.about.get({
          fields: 'user',
        });
        console.log(
          `[uploadFileToDriveUser] Access token valid for user: ${
            aboutResponse.data.user?.displayName || 'Unknown'
          }`
        );
      } catch (tokenError) {
        console.error(
          `[uploadFileToDriveUser] Access token verification failed:`,
          tokenError
        );
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Google access token không hợp lệ hoặc đã hết hạn.'
        );
      }

      // Verify we can access the project folder
      try {
        console.log(
          `[uploadFileToDriveUser] Verifying access to project folder`
        );
        const folderInfo = await drive.files.get({
          fileId: projectData.driveFolderId,
          fields: 'id,name,mimeType',
        });
        console.log(
          `[uploadFileToDriveUser] Project folder accessible: ${folderInfo.data.name}`
        );
      } catch (folderError) {
        console.error(
          `[uploadFileToDriveUser] Cannot access project folder:`,
          folderError
        );
        throw new functions.https.HttpsError(
          'permission-denied',
          'Không có quyền truy cập thư mục dự án. Vui lòng kiểm tra quyền truy cập Google Drive.'
        );
      }

      console.log(
        `[uploadFileToDriveUser] Looking for QC_Reports folder in project folder`
      );
      // Find or create QC_Reports folder
      const listRes = await drive.files.list({
        q: `name='QC_Reports' and '${projectData.driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name,parents)',
        spaces: 'drive',
      });

      console.log(
        `[uploadFileToDriveUser] QC_Reports folder search result:`,
        JSON.stringify(listRes.data.files)
      );

      let qcFolderId = listRes.data.files?.[0]?.id;

      if (!qcFolderId) {
        console.log(
          `[uploadFileToDriveUser] QC_Reports folder not found, creating new one`
        );
        const folderRes = await drive.files.create({
          requestBody: {
            name: 'QC_Reports',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [projectData.driveFolderId],
          },
          fields: 'id,name,parents',
        });

        qcFolderId = folderRes.data.id!;
        console.log(
          `[uploadFileToDriveUser] Created new QC_Reports folder with ID: ${qcFolderId}`
        );
        console.log(
          `[uploadFileToDriveUser] New folder details:`,
          JSON.stringify(folderRes.data)
        );
      } else {
        console.log(
          `[uploadFileToDriveUser] Found existing QC_Reports folder with ID: ${qcFolderId}`
        );
      }

      // Verify we can access the QC_Reports folder
      try {
        console.log(
          `[uploadFileToDriveUser] Verifying access to QC_Reports folder`
        );
        const folderInfo = await drive.files.get({
          fileId: qcFolderId,
          fields: 'id,name,mimeType,parents',
        });
        console.log(
          `[uploadFileToDriveUser] QC_Reports folder accessible: ${folderInfo.data.name}`
        );
        console.log(
          `[uploadFileToDriveUser] QC_Reports folder parent: ${folderInfo.data.parents?.[0]}`
        );

        // Verify this folder is actually in the project folder
        if (folderInfo.data.parents?.[0] !== projectData.driveFolderId) {
          console.warn(
            `[uploadFileToDriveUser] WARNING: QC_Reports folder is not in the project folder!`
          );
          console.warn(
            `[uploadFileToDriveUser] Expected parent: ${projectData.driveFolderId}, Actual parent: ${folderInfo.data.parents?.[0]}`
          );
        }
      } catch (folderError) {
        console.error(
          `[uploadFileToDriveUser] Cannot access QC_Reports folder:`,
          folderError
        );
        throw new functions.https.HttpsError(
          'permission-denied',
          'Không có quyền truy cập thư mục QC_Reports. Vui lòng kiểm tra quyền truy cập Google Drive.'
        );
      }

      console.log(
        `[uploadFileToDriveUser] Preparing file upload to QC_Reports folder`
      );
      const buffer = Buffer.from(base64Data, 'base64');
      const stream = Readable.from(buffer);
      console.log(
        `[uploadFileToDriveUser] File buffer size: ${buffer.length} bytes`
      );

      // Log the file information before upload
      console.log(`[uploadFileToDriveUser] Uploading file with parameters:
        Name: ${fileName}
        MimeType: ${mimeType}
        Target folder: ${qcFolderId}
        File size: ${buffer.length} bytes`);

      const fileRes = await drive.files.create({
        requestBody: { name: fileName, mimeType, parents: [qcFolderId] },
        media: { mimeType, body: stream },
        fields:
          'id, webViewLink, thumbnailLink, mimeType, webContentLink, parents',
      });

      console.log(
        `[uploadFileToDriveUser] File uploaded successfully with ID: ${fileRes.data.id}`
      );
      console.log(
        `[uploadFileToDriveUser] File webViewLink: ${fileRes.data.webViewLink}`
      );
      console.log(
        `[uploadFileToDriveUser] File parent folder: ${fileRes.data.parents?.[0]}`
      );

      // Verify file was uploaded to correct folder
      if (fileRes.data.parents?.[0] !== qcFolderId) {
        console.warn(
          `[uploadFileToDriveUser] WARNING: File was not uploaded to the QC_Reports folder!`
        );
        console.warn(
          `[uploadFileToDriveUser] Expected parent: ${qcFolderId}, Actual parent: ${fileRes.data.parents?.[0]}`
        );
      }

      await drive.permissions.create({
        fileId: fileRes.data.id!,
        requestBody: { role: 'reader', type: 'anyone' },
      });
      console.log(`[uploadFileToDriveUser] Permissions set to public for file`);

      // Get file metadata to verify it exists
      try {
        const fileMetadata = await drive.files.get({
          fileId: fileRes.data.id!,
          fields: 'id,name,webViewLink,parents',
        });
        console.log(
          `[uploadFileToDriveUser] File verification - Name: ${fileMetadata.data.name}, Parent: ${fileMetadata.data.parents?.[0]}`
        );

        // List files in the QC_Reports folder to verify the file is there
        console.log(
          `[uploadFileToDriveUser] Listing files in QC_Reports folder to verify...`
        );
        const filesInFolder = await drive.files.list({
          q: `'${qcFolderId}' in parents and trashed=false`,
          fields: 'files(id,name)',
          spaces: 'drive',
        });

        console.log(
          `[uploadFileToDriveUser] Files in QC_Reports folder:`,
          JSON.stringify(filesInFolder.data.files)
        );

        // Check if our file is in the list
        const fileInFolder = filesInFolder.data.files?.find(
          (f) => f.id === fileRes.data.id
        );
        if (fileInFolder) {
          console.log(
            `[uploadFileToDriveUser] Confirmed file exists in QC_Reports folder`
          );
        } else {
          console.warn(
            `[uploadFileToDriveUser] WARNING: File not found in QC_Reports folder list!`
          );
        }
      } catch (verifyErr) {
        console.error(
          `[uploadFileToDriveUser] Error verifying file: ${verifyErr}`
        );
      }

      return {
        success: true,
        fileId: fileRes.data.id,
        webViewLink: fileRes.data.webViewLink,
        thumbnailLink:
          fileRes.data.thumbnailLink || fileRes.data.webContentLink,
        mimeType: fileRes.data.mimeType,
        fileName: fileName,
      };
    } catch (err: any) {
      console.error('[uploadFileToDriveUser] Error:', err);
      throw new functions.https.HttpsError(
        'internal',
        err.message || 'Lỗi nội bộ'
      );
    }
  });
