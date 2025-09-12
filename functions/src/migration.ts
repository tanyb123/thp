import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// Make sure to replace with your actual service account credentials
// const serviceAccount = require('../service-account-credentials.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

const db = admin.firestore();

export async function updateUserSchema() {
  const usersSnapshot = await db.collection('users').get();
  const batch = db.batch();

  usersSnapshot.forEach((doc) => {
    const userRef = db.collection('users').doc(doc.id);
    batch.update(userRef, {
      annualLeaveBalance: 12, // Default value
      insuranceContributionBase: 5500000, // Default value, adjust as needed
    });
  });

  await batch.commit();
  console.log('Users schema updated successfully.');
}

                            export async function createGlobalSettings() {
  const settingsRef = db.collection('settings').doc('companyConfig');
  await settingsRef.set({
    standardWorkingDays: 26, // Example value, adjust as needed
    overtimeMultipliers: {
      normal: 1.5,
      sunday: 2.0,
      holiday: 3.0,
    },
  });
  console.log('Global settings created successfully.');
}

export async function runMigrations() {
  try {
    await updateUserSchema();
    await createGlobalSettings();
    console.log('All migrations completed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
  }
}

// To run this script, you would typically call runMigrations()
// For example, from a CLI or another function.
// runMigrations();
