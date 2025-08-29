import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as path from 'path';

// Chỉ import 'googleapis' bên trong hàm khi cần
// import { google } from 'googleapis';

// Firebase Storage bucket (not used after switching to Drive-only upload)
// const storage = admin.storage().bucket();

/**
 * Callable function that takes a Google Sheet ID and exports it as PDF using Google Drive API
 * then uploads the PDF to Firebase Storage and returns a public URL
 */
export const exportSheetToPdf = functions
  .region('us-central1') // Explicitly specify the region
  .runWith({
    timeoutSeconds: 300,
    memory: '1GB',
  })
  .https.onCall(async (data, context) => {
    // Lazy load the googleapis library
    const { google } = await import('googleapis');

    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Bạn cần đăng nhập để sử dụng tính năng này.'
      );
    }

    // Validate input parameters
    const { spreadsheetId, fileName, projectId, accessToken } = data;
    if (!spreadsheetId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu ID của Google Sheet.'
      );
    }

    if (!fileName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu tên file cho PDF.'
      );
    }

    if (!projectId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Thiếu ID dự án.'
      );
    }

    try {
      let auth: any;
      // Build auth/sheets depending on whether we have an end-user token
      if (accessToken) {
        const userAuth = new google.auth.OAuth2();
        userAuth.setCredentials({ access_token: accessToken });
        auth = userAuth;
      } else {
        auth = new google.auth.GoogleAuth({
          keyFile: path.join(__dirname, '../tanyb-fe4bf-4fbd5c01b6c7.json'),
          scopes: [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/spreadsheets.readonly',
          ],
        });
      }

      const sheets = google.sheets({ version: 'v4', auth });

      // Step 1: Get the data from column A to determine the last row with content
      const sheetsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'A:A', // Only examine column A to determine the last row
      });

      // Calculate the last row with content
      const values = sheetsResponse.data.values || [];
      let lastRow = 0;

      // Find the last non-empty row
      for (let i = 0; i < values.length; i++) {
        if (values[i] && values[i][0]) {
          lastRow = i + 1; // Convert to 1-indexed
        }
      }

      // Add buffer rows to ensure we capture all content
      const bufferRows = 6;
      const dynamicRange = `A1:G${lastRow + bufferRows}`;

      functions.logger.info(
        `Calculated dynamic range: ${dynamicRange} (last row: ${lastRow})`
      );

      // Step 2: Build a custom export URL that limits the print area to columns A:G and rows 1 → lastRow + buffer.
      // Google Sheets accepts the parameters r1, r2, c1, c2 (0-based, r2/c2 are exclusive) together with a gid that identifies the sheet.
      const sheetMeta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(sheetId))',
      });

      const sheetId = sheetMeta.data.sheets?.[0]?.properties?.sheetId ?? 0;

      const r1 = 0; // start row (0-based)
      // Guarantee export always reaches at least the bottom of the template (row 36)
      const MIN_TEMPLATE_ROWS = 36;
      const r2 = Math.max(lastRow + bufferRows, MIN_TEMPLATE_ROWS); // end row (exclusive)
      const c1 = 0; // column A (0-based)
      // Include column H (index 7) so the right-hand border of the template is preserved
      const c2 = 8; // exclusive end index

      const exportUrl =
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export` +
        `?format=pdf` +
        `&gid=${sheetId}` +
        `&portrait=true` +
        `&size=a4` +
        `&scale=2` +
        `&gridlines=false` +
        `&sheetnames=false` +
        `&printtitle=true` +
        `&pagenum=UNDEFINED` +
        `&r1=${r1}&r2=${r2}&c1=${c1}&c2=${c2}`;

      functions.logger.info(`Export URL: ${exportUrl}`);

      // Use the authenticated HTTP client to download the PDF as a stream
      const authClient =
        typeof auth.getClient === 'function' ? await auth.getClient() : auth;
      const pdfResponse = await authClient.request({
        url: exportUrl,
        method: 'GET',
        responseType: 'stream',
      });

      const pdfStream = (pdfResponse as any).data as NodeJS.ReadableStream;

      if (!pdfStream) {
        throw new functions.https.HttpsError(
          'internal',
          'Không thể xuất file PDF từ Google Sheet.'
        );
      }

      // Get project folder info from Firestore
      const projectDoc = await admin
        .firestore()
        .collection('projects')
        .doc(projectId)
        .get();
      const projectData = projectDoc.data();

      if (!projectData || !projectData.driveFolderId) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Không tìm thấy thông tin thư mục Drive của dự án.'
        );
      }

      // Find 'baogia' subfolder in project folder
      const baogiaFolderResponse = await authClient.request({
        url: 'https://www.googleapis.com/drive/v3/files',
        method: 'GET',
        params: {
          q: `name='baogia' and '${projectData.driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
        },
      });

      // Type casting for the response
      interface DriveFilesResponse {
        files?: { id: string }[];
      }

      const responseData = baogiaFolderResponse.data as DriveFilesResponse;

      let baogiaFolderId;
      if (responseData.files && responseData.files.length > 0) {
        baogiaFolderId = responseData.files[0].id;
      } else {
        // Create 'baogia' folder if it doesn't exist
        const driveClient = google.drive({
          version: 'v3',
          auth: authClient,
        });
        const folderResponse = await driveClient.files.create({
          requestBody: {
            name: 'baogia',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [projectData.driveFolderId],
          },
          fields: 'id',
        });
        baogiaFolderId = folderResponse.data.id;
      }

      // Define sanitized filename first
      const sanitizedFileName = fileName.replace(/[^a-z0-9.]/gi, '_');

      // Upload PDF trực tiếp lên Google Drive và trả về link, tránh phụ thuộc Firebase Storage (tránh lỗi bucket 404)
      try {
        const driveClient = google.drive({ version: 'v3', auth: authClient });
        const uploadRes = await driveClient.files.create({
          requestBody: {
            name: `${sanitizedFileName}.pdf`,
            mimeType: 'application/pdf',
            parents: baogiaFolderId ? [baogiaFolderId] : undefined,
          },
          media: {
            mimeType: 'application/pdf',
            body: pdfStream,
          },
          fields: 'id, webViewLink, webContentLink',
        });

        const fileId = uploadRes.data.id as string;

        // Mở quyền xem cho bất kỳ ai có link
        try {
          await driveClient.permissions.create({
            fileId,
            requestBody: { role: 'reader', type: 'anyone' },
          });
        } catch (permErr) {
          functions.logger.warn(
            'Failed to set Drive file permission:',
            permErr
          );
        }

        const pdfUrl = (uploadRes.data.webContentLink ||
          uploadRes.data.webViewLink) as string;

        return {
          pdfUrl,
          lastRow,
          dynamicRange,
          usedUrl: exportUrl,
        };
      } catch (uploadErr: any) {
        functions.logger.error('Error uploading PDF to Drive:', uploadErr);
        throw new functions.https.HttpsError(
          'internal',
          `Không thể upload PDF lên Google Drive: ${
            uploadErr?.message || 'Unknown error'
          }`
        );
      }
    } catch (error) {
      functions.logger.error('Error in exportSheetToPdf:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Lỗi khi xuất file PDF: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  });
