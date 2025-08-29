import {
  onDocumentDeleted,
  onDocumentCreated,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const db = admin.firestore();
const ROOT_FOLDER_ID = '18OrAEBSuZzz-AFbqlitz5gUxpsdunXjX'; // Baogia root folder ID

/**
 * Creates a Google Drive folder structure for a new project
 */
export const onProjectCreate = onDocumentCreated(
  {
    document: 'projects/{projectId}',
    region: 'asia-southeast1',
  },
  async (event) => {
    const { projectId } = event.params;
    const projectData = event.data?.data();
    if (!projectData) {
      console.log(`No data found for project ${projectId}.`);
      return;
    }

    console.log(`Processing new project: ${projectData.name}`);

    try {
      // Step 1: Create public tracking token IMMEDIATELY (không phụ thuộc Google Drive)
      const publicTrackingToken = uuidv4().replace(/-/g, '');

      // Step 2: Update project with token first
      await db.collection('projects').doc(projectId).update({
        publicTrackingToken: publicTrackingToken,
      });

      console.log(
        `Created tracking token for project ${projectId}: ${publicTrackingToken}`
      );

      // Step 3: Try to create Google Drive folders (optional, không block token creation)
      try {
        await createGoogleDriveFolders(projectId, projectData);
      } catch (driveError) {
        console.error(
          `Google Drive folder creation failed for project ${projectId}:`,
          driveError
        );
        // Continue execution even if Drive fails
      }

      console.log(`Successfully processed project ${projectId}.`);
    } catch (error) {
      console.error(`Error processing project ${projectId}:`, error);
    }
  }
);

// Tách riêng function tạo Google Drive folders
async function createGoogleDriveFolders(projectId: string, projectData: any) {
  console.log(`Creating Drive folders for project: ${projectData.name}`);

  // Initialize Google Drive API
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../tanyb-fe4bf-4fbd5c01b6c7.json'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // Get current date for folder structure (YYYY/MM/DD)
  const createdDate = projectData.createdAt?.toDate() || new Date();
  const year = createdDate.getFullYear().toString();
  const month = (createdDate.getMonth() + 1).toString().padStart(2, '0');
  const day = createdDate.getDate().toString().padStart(2, '0');

  // Clean project name for use in folder name (remove invalid chars)
  const cleanProjectName = projectData.name.replace(/[\/\\:*?"<>|]/g, '_');

  // Step 1: Find or create year folder
  const yearFolder = await findOrCreateFolder(drive, year, ROOT_FOLDER_ID);
  if (!yearFolder) {
    throw new Error(`Failed to create year folder ${year}`);
  }

  // Step 2: Find or create month folder
  const monthFolder = await findOrCreateFolder(drive, month, yearFolder.id);
  if (!monthFolder) {
    throw new Error(`Failed to create month folder ${month}`);
  }

  // Step 3: Find or create day folder
  const dayFolder = await findOrCreateFolder(drive, day, monthFolder.id);
  if (!dayFolder) {
    throw new Error(`Failed to create day folder ${day}`);
  }

  // Step 4: Create project folder
  const projectFolder = await createFolder(
    drive,
    cleanProjectName,
    dayFolder.id
  );
  if (!projectFolder) {
    throw new Error(`Failed to create project folder ${cleanProjectName}`);
  }

  // Step 5: Create subfolders (baogia, hopdong)
  const baogiaFolder = await createFolder(drive, 'baogia', projectFolder.id);
  const hopdongFolder = await createFolder(drive, 'hopdong', projectFolder.id);

  console.log(
    `Created subfolders: baogia (${baogiaFolder.id}) and hopdong (${hopdongFolder.id})`
  );

  // Step 6: Update project document with Drive folder info
  await db.collection('projects').doc(projectId).update({
    driveFolderId: projectFolder.id,
    driveFolderUrl: projectFolder.webViewLink,
    driveCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Successfully created Drive folders for project ${projectId}.`);
}

/**
 * Automatically deducts materials from inventory when a project is marked as "completed".
 */
export const onProjectComplete = onDocumentUpdated(
  {
    document: 'projects/{projectId}',
    region: 'asia-southeast1',
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Proceed only if the status changes TO "completed"
    if (
      !beforeData ||
      !afterData ||
      beforeData.status === 'completed' ||
      afterData.status !== 'completed'
    ) {
      return null;
    }

    const { projectId } = event.params;
    const projectName = afterData.name || 'Dự án không tên';
    console.log(
      `Project "${projectName}" (${projectId}) completed. Starting inventory deduction.`
    );

    // 1. Find the approved quotation for this project to get the material list
    const quotationsRef = db.collection('quotations');
    const q = quotationsRef
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .limit(1);

    const quotationSnapshot = await q.get();

    if (quotationSnapshot.empty) {
      console.log(
        `No quotation found for project ${projectId}. No materials to deduct.`
      );
      return null;
    }

    const quotationData = quotationSnapshot.docs[0].data();
    const materialsToDeduct = quotationData.materials;

    if (!materialsToDeduct || materialsToDeduct.length === 0) {
      console.log(
        `Quotation for project ${projectId} has no materials listed.`
      );
      return null;
    }

    // 2. Process each material
    const promises = materialsToDeduct.map(async (material) => {
      const neededQty = Number(material.quantity) || 0;
      if (neededQty <= 0) {
        return; // Skip if quantity is zero or invalid
      }

      const name = String(material.name || '').trim();
      const code = String(material.code || '').trim();

      if (!name && !code) {
        return; // Skip if no identifier
      }

      // Find the item in inventory
      let itemQuery: admin.firestore.Query = db.collection('inventory');
      if (code) {
        itemQuery = itemQuery.where('code', '==', code);
      } else {
        itemQuery = itemQuery.where('name', '==', name);
      }

      const inventorySnapshot = await itemQuery.limit(1).get();

      if (inventorySnapshot.empty) {
        console.log(
          `Material "${name}" (Code: ${code}) not found in inventory. Skipping deduction.`
        );
        return;
      }

      // Item found, proceed with deduction
      const itemDoc = inventorySnapshot.docs[0];
      const itemData = itemDoc.data();
      const currentQty = Number(itemData.stockQuantity) || 0;
      const newQty = currentQty - neededQty;

      console.log(
        `Deducting ${neededQty} of "${name}" from inventory. Current: ${currentQty}, New: ${newQty}`
      );

      // Use a transaction to ensure atomicity
      await db.runTransaction(async (transaction) => {
        // Update inventory stock
        transaction.update(itemDoc.ref, {
          stockQuantity: newQty,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create a transaction log
        const transactionRef = db.collection('inventory_transactions').doc();
        transaction.set(transactionRef, {
          itemId: itemDoc.id,
          type: 'out',
          quantity: neededQty,
          reason: `Sử dụng cho dự án: ${projectName}`,
          date: admin.firestore.FieldValue.serverTimestamp(),
          projectId: projectId,
          // Assuming there's a system or admin user for this action.
          // In a real app, you might want to attribute this to a specific user.
          createdBy: 'SYSTEM_AUTO_DEDUCT',
          createdByName: 'Hệ thống',
        });
      });
    });

    await Promise.all(promises);
    console.log(
      `Finished inventory deduction process for project ${projectId}.`
    );

    return null;
  }
);

/**
 * Deletes all tasks associated with a project when the project is deleted.
 */
export const onProjectDeleted = onDocumentDeleted(
  {
    document: 'projects/{projectId}',
    region: 'asia-southeast1',
  },
  async (event) => {
    const { projectId } = event.params;
    console.log(`Project ${projectId} deleted. Deleting associated tasks...`);

    const tasksRef = db.collection('tasks');
    const query = tasksRef.where('projectId', '==', projectId);

    try {
      const snapshot = await query.get();
      if (snapshot.empty) {
        console.log(`No tasks found for project ${projectId}.`);
        return;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(
        `Successfully deleted ${snapshot.size} tasks for project ${projectId}.`
      );
    } catch (error) {
      console.error(`Error deleting tasks for project ${projectId}:`, error);
    }
  }
);

/**
 * Helper function to find a folder by name in a parent folder or create it if it doesn't exist
 */
async function findOrCreateFolder(drive, folderName, parentFolderId) {
  // Search for folder
  const response = await drive.files.list({
    q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, webViewLink)',
  });

  // If folder exists, return it
  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0];
  }

  // Otherwise create new folder
  return createFolder(drive, folderName, parentFolderId);
}

/**
 * Helper function to create a new folder
 */
async function createFolder(drive, folderName, parentFolderId) {
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId],
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id, name, webViewLink',
  });

  return folder.data;
}
