import { google } from 'googleapis';
import * as path from 'path';
import { SERVICE_ACCOUNT_KEY_PATH } from '../config';

/**
 * Returns an authenticated Google Drive client using the unified service account.
 */
export const getDriveClient = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, SERVICE_ACCOUNT_KEY_PATH),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
};
