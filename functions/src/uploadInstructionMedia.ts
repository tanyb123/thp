import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { Readable } from 'stream';

const db = admin.firestore();

/**
 * Upload instruction media (images, audio) to Google Drive using user access token
 * Creates an "Instructions" folder in the project's Drive folder
 */
export const uploadInstructionMedia = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Người dùng chưa đăng nhập.'
      );
    }

    const { accessToken, projectId, fileName, mimeType, base64Data } = data;

    // Validate input
    if (!accessToken || !projectId || !fileName || !mimeType || !base64Data) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu thông tin cần thiết: accessToken, projectId, fileName, mimeType, base64Data'
      );
    }

    console.log(
      `[uploadInstructionMedia] Starting upload for project: ${projectId}`
    );
    console.log(
      `[uploadInstructionMedia] File: ${fileName}, Type: ${mimeType}`
    );

    try {
      // Get project data
      const projectSnap = await db.collection('projects').doc(projectId).get();
      const projectData = projectSnap.data();

      if (!projectData || !projectData.driveFolderId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Không tìm thấy thư mục Drive của dự án.'
        );
      }

      console.log(
        `[uploadInstructionMedia] Project Drive folder: ${projectData.driveFolderId}`
      );

      // Build Drive client with user's OAuth token
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth });

      // Verify access token works
      try {
        console.log(`[uploadInstructionMedia] Verifying access token validity`);
        const aboutResponse = await drive.about.get({
          fields: 'user',
        });
        console.log(
          `[uploadInstructionMedia] Access token valid for user: ${
            aboutResponse.data.user?.displayName || 'Unknown'
          }`
        );
      } catch (tokenError) {
        console.error(
          `[uploadInstructionMedia] Access token verification failed:`,
          tokenError
        );
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Google access token không hợp lệ hoặc đã hết hạn.'
        );
      }

      // Step 1: Find or create Instructions subfolder
      const folderQuery = await drive.files.list({
        q: `name='Instructions' and '${projectData.driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      let instructionsFolderId: string | undefined;
      if (folderQuery.data.files && folderQuery.data.files.length > 0) {
        instructionsFolderId = folderQuery.data.files[0].id;
        console.log(
          `[uploadInstructionMedia] Found existing Instructions folder: ${instructionsFolderId}`
        );
      } else {
        console.log(
          `[uploadInstructionMedia] Creating new Instructions folder`
        );
        const folderRes = await drive.files.create({
          requestBody: {
            name: 'Instructions',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [projectData.driveFolderId],
          },
          fields: 'id',
        });
        instructionsFolderId = folderRes.data.id;
        console.log(
          `[uploadInstructionMedia] Created Instructions folder: ${instructionsFolderId}`
        );
      }

      if (!instructionsFolderId) {
        throw new functions.https.HttpsError(
          'internal',
          'Không thể tạo hoặc tìm Instructions folder.'
        );
      }

      // Step 2: Upload file
      console.log(
        `[uploadInstructionMedia] Preparing file upload to Instructions folder`
      );
      const buffer = Buffer.from(base64Data, 'base64');
      const stream = Readable.from(buffer);
      console.log(
        `[uploadInstructionMedia] File buffer size: ${buffer.length} bytes`
      );

      const fileRes = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType,
          parents: [instructionsFolderId],
        },
        media: {
          mimeType,
          body: stream,
        },
        fields:
          'id, webViewLink, thumbnailLink, mimeType, webContentLink, parents',
      });

      console.log(
        `[uploadInstructionMedia] File uploaded successfully with ID: ${fileRes.data.id}`
      );
      console.log(
        `[uploadInstructionMedia] File webViewLink: ${fileRes.data.webViewLink}`
      );

      // Step 3: Set permissions to make file viewable by anyone with link
      await drive.permissions.create({
        fileId: fileRes.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      console.log(`[uploadInstructionMedia] File permissions set successfully`);

      // Step 4: Generate a direct download URL for all media types
      const publicUrl = `https://drive.google.com/uc?export=download&id=${fileRes
        .data.id!}`;

      const result = {
        fileId: fileRes.data.id,
        webViewLink: fileRes.data.webViewLink,
        thumbnailLink: fileRes.data.thumbnailLink,
        mimeType: fileRes.data.mimeType,
        webContentLink: fileRes.data.webContentLink,
        publicUrl,
        fileName,
      };

      console.log(
        `[uploadInstructionMedia] Upload completed successfully:`,
        result
      );
      return result;
    } catch (error) {
      console.error(`[uploadInstructionMedia] Error:`, error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        `Lỗi khi upload file: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  });
