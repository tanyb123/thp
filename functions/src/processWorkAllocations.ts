import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Scheduled Cloud Function that runs nightly to process
 * daily work allocations and convert them to labor expenses.
 *
 * This function:
 * 1. Retrieves all unprocessed daily work allocations
 * 2. For each allocation, creates expense records for all worker hours
 * 3. Marks allocations as processed once complete
 */
export const processWorkAllocations = functions
  .region('asia-southeast1')
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '1GB',
  })
  .pubsub.schedule('0 2 * * *') // Run at 2:00 AM daily
  .timeZone('Asia/Ho_Chi_Minh')
  .onRun(async (context) => {
    const db = admin.firestore();
    console.log('Starting processWorkAllocations scheduled function');

    try {
      // Get all unprocessed work allocations
      const unprocessedAllocationsSnapshot = await db
        .collection('daily_work_allocations')
        .where('isProcessed', '==', false)
        .get();

      console.log(
        `Found ${unprocessedAllocationsSnapshot.size} unprocessed allocations`
      );

      if (unprocessedAllocationsSnapshot.empty) {
        console.log('No unprocessed allocations found. Exiting.');
        return null;
      }

      // Process each allocation
      for (const allocDoc of unprocessedAllocationsSnapshot.docs) {
        const allocation = allocDoc.data();
        const allocId = allocDoc.id;
        const allocDate = allocation.date;

        console.log(`Processing allocation ${allocId} for date ${allocDate}`);

        // Skip if there are no allocations data
        if (
          !allocation.allocations ||
          Object.keys(allocation.allocations).length === 0
        ) {
          console.log(
            `No worker allocations found in document ${allocId}. Marking as processed.`
          );
          await allocDoc.ref.update({ isProcessed: true });
          continue;
        }

        // Create a set to track all projects involved
        const projectIds = new Set<string>();

        // Create a map to store project names for lookup
        const projectNames: Record<string, string> = {};

        // First pass - collect all project IDs
        for (const [, workerAllocations] of Object.entries(
          allocation.allocations
        )) {
          if (Array.isArray(workerAllocations)) {
            for (const projectAllocation of workerAllocations) {
              if (projectAllocation.projectId) {
                projectIds.add(projectAllocation.projectId);
              }
            }
          }
        }

        // Batch fetch project data
        if (projectIds.size > 0) {
          const projectPromises = Array.from(projectIds).map(async (pid) => {
            const projectDoc = await db.collection('projects').doc(pid).get();
            if (projectDoc.exists) {
              const projectData = projectDoc.data();
              projectNames[pid] = projectData?.name || 'Dự án không tên';
            }
            return pid;
          });

          await Promise.all(projectPromises);
          console.log(
            `Fetched names for ${Object.keys(projectNames).length} projects`
          );
        }

        // Fetch worker data in batch
        const workerIds = Object.keys(allocation.allocations);
        const workerData: Record<
          string,
          { name: string; dailySalary: number }
        > = {};

        const workerBatchPromises = workerIds.map(async (wid) => {
          const userDoc = await db.collection('users').doc(wid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            workerData[wid] = {
              name:
                userData?.displayName ||
                userData?.email ||
                'Công nhân không tên',
              dailySalary: userData?.dailySalary || 0,
            };
          }
          return wid;
        });

        await Promise.all(workerBatchPromises);
        console.log(
          `Fetched data for ${Object.keys(workerData).length} workers`
        );

        // Process each worker allocation
        const expensePromises = [];

        for (const [workerId, workerAllocations] of Object.entries(
          allocation.allocations
        )) {
          const worker = workerData[workerId];

          // Skip if worker not found or has no daily salary
          if (!worker || worker.dailySalary <= 0) {
            console.log(
              `Skipping worker ${workerId}: no data or no daily salary.`
            );
            continue;
          }

          if (!Array.isArray(workerAllocations)) {
            console.log(
              `Skipping worker ${workerId}: invalid allocations format.`
            );
            continue;
          }

          console.log(
            `Processing worker ${worker.name} (${workerId}) with daily salary: ${worker.dailySalary}`
          );

          // Process each project allocation
          for (const projectAllocation of workerAllocations) {
            const { projectId, hours } = projectAllocation;

            // Skip if no projectId or hours
            if (!projectId || typeof hours !== 'number' || hours <= 0) {
              console.log(
                `Skipping invalid project allocation for worker ${workerId}`
              );
              continue;
            }

            // Calculate cost based on 8-hour workday
            const dailySalary = worker.dailySalary;
            const hourlyRate = dailySalary / 8;
            const cost = hours * hourlyRate;

            // Skip if cost is zero
            if (cost <= 0) {
              console.log(
                `Skipping zero-cost allocation for worker ${workerId} on project ${projectId}`
              );
              continue;
            }

            // Create expense record
            const expenseData = {
              projectId: projectId,
              projectName: projectNames[projectId] || 'Dự án không tên',
              type: 'labor',
              amount: cost,
              description: `Chi phí nhân công cho ${worker.name} (${hours} giờ)`,
              date: admin.firestore.Timestamp.fromDate(
                typeof allocDate === 'string'
                  ? new Date(allocDate)
                  : allocDate instanceof admin.firestore.Timestamp
                  ? allocDate.toDate()
                  : new Date()
              ),
              relatedDocId: allocId,
              createdBy: allocation.allocatedBy_userId || 'system',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Add to batch of promises
            const promise = db
              .collection('expenses')
              .add(expenseData)
              .then((ref) => {
                console.log(
                  `Created expense record ${ref.id} for worker ${
                    worker.name
                  } on project ${projectId}: ${cost.toLocaleString('vi')} đ`
                );
                return {
                  id: ref.id,
                  workerId,
                  projectId,
                  amount: cost,
                  hours,
                };
              });

            expensePromises.push(promise);
          }
        }

        // Wait for all expense creations to complete
        const expenseResults = await Promise.all(expensePromises);
        console.log(
          `Created ${expenseResults.length} expense records for allocation ${allocId}`
        );

        // Mark allocation as processed
        await allocDoc.ref.update({
          isProcessed: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          expensesCreated: expenseResults,
        });

        console.log(`Marked allocation ${allocId} as processed`);
      }

      console.log('Finished processing all work allocations');
      return null;
    } catch (error) {
      console.error('Error in processWorkAllocations:', error);
      return null;
    }
  });
