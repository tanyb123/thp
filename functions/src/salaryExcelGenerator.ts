import * as functions from 'firebase-functions/v1';

// Placeholder to avoid build error when file is empty. Real implementation was refactored elsewhere.
// Keep a minimal callable that returns 501 to indicate not implemented here.
export const generateSalaryExcel = functions
  .region('asia-southeast1')
  .https.onCall(async () => {
      return {
      status: 501,
      message: 'generateSalaryExcel moved to client export flow.',
    };
  });
