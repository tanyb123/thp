import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import * as path from 'path';
import { Readable } from 'stream';

// Helper to detect quota/rate-limit errors
function isQuotaError(error: any): boolean {
  if (!error) return false;
  const status = error.code || error.status;
  const message = (error.message || '').toLowerCase();
  return (
    status === 403 ||
    status === 429 ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('user rate limit exceeded') ||
    message.includes('quota exceeded')
  );
}

// Exponential-backoff retry helper
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0 && isQuotaError(err)) {
      console.log(
        `Quota error – retrying in ${delay} ms, attempts left ${retries}`
      );
      await new Promise((res) => setTimeout(res, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

// Build Drive client either with service account or user OAuth token
const buildDriveClient = async (accessToken?: string) => {
  if (accessToken) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth });
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../tanyb-fe4bf-4fbd5c01b6c7.json'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
};

/**
 * confirmPOReceipt
 * Allows QA/QC to upload photos confirming that materials in a PO have been received.
 * - Uploads images to Drive under <Project>/PO_Receipts/<PO_ID>
 * - Updates purchase_orders doc: status -> "received", receivedAt, receiptPhotos[]
 */
export const confirmPOReceipt = functions
  .region('asia-southeast1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const {
      poId,
      projectId,
      files,
      remarks = '',
      accessToken,
    } = data as {
      poId?: string;
      projectId?: string;
      files?: Array<{ fileName: string; mimeType: string; base64Data: string }>;
      remarks?: string;
      accessToken?: string;
    };

    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn cần đăng nhập'
      );
    }

    if (!poId || !projectId || !files || files.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu tham số bắt buộc'
      );
    }

    try {
      const db = admin.firestore();
      const poRef = db.collection('purchase_orders').doc(poId);
      const poSnap = await poRef.get();
      if (!poSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Không tìm thấy PO');
      }

      const projectSnap = await db.collection('projects').doc(projectId).get();
      const projectData = projectSnap.data();
      if (!projectData || !projectData.driveFolderId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Không tìm thấy folder Drive dự án'
        );
      }

      const drive = await buildDriveClient(accessToken);

      // Find or create QC_Reports folder inside project folder
      const receiptFolderRes = await withRetry(() =>
        drive.files.list({
          q: `name='QC_Reports' and '${projectData.driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
          spaces: 'drive',
        })
      );

      let qcFolderId = receiptFolderRes.data.files?.[0]?.id;
      if (!qcFolderId) {
        const createFolder = await withRetry(() =>
          drive.files.create({
            requestBody: {
              name: 'QC_Reports',
              mimeType: 'application/vnd.google-apps.folder',
              parents: [projectData.driveFolderId],
            },
            fields: 'id',
          })
        );
        qcFolderId = createFolder.data.id!;
      }

      // Upload each file
      const uploaded: Array<{
        fileId: string;
        webViewLink: string;
        mimeType: string;
      }> = [];
      for (const f of files) {
        // Add PO ID prefix to filename for better identification
        const poFileName = `PO_${poId}_${f.fileName}`;
        const buffer = Buffer.from(f.base64Data, 'base64');
        const stream = Readable.from(buffer);
        const fileRes = await withRetry(() =>
          drive.files.create({
            requestBody: {
              name: poFileName,
              mimeType: f.mimeType,
              parents: [qcFolderId],
            },
            media: { mimeType: f.mimeType, body: stream },
            fields: 'id,webViewLink,mimeType,webContentLink',
          })
        );

        await withRetry(() =>
          drive.permissions.create({
            fileId: fileRes.data.id!,
            requestBody: { role: 'reader', type: 'anyone' },
          })
        );

        uploaded.push({
          fileId: fileRes.data.id!,
          webViewLink: fileRes.data.webViewLink!,
          mimeType: fileRes.data.mimeType!,
        });
      }

      // Update PO document
      await poRef.update({
        status: 'received',
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        receiptPhotos: uploaded,
        receiptRemarks: remarks,
      });

      return { success: true, uploaded };
    } catch (err: any) {
      console.error('confirmPOReceipt error', err);
      throw new functions.https.HttpsError(
        'internal',
        err.message || 'Lỗi xử lý xác nhận PO'
      );
    }
  });
