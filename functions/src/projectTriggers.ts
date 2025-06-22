import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

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
