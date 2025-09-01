import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import cors from 'cors';

const db = admin.firestore();
const corsHandler = cors({ origin: true });

/**
 * Public API endpoint for project status tracking
 * Allows customers to view project progress using a tracking token
 */
export const getProjectStatusByToken = onRequest(
  {
    region: 'asia-southeast1',
    cors: true,
  },
  async (request, response) => {
    // Handle CORS preflight requests
    return corsHandler(request, response, async () => {
      try {
        // Only allow GET requests
        if (request.method !== 'GET') {
          response.status(405).json({
            error: 'Method not allowed',
            message: 'Only GET requests are supported',
          });
          return;
        }

        // Get token from query parameters
        const { token } = request.query;

        if (!token || typeof token !== 'string') {
          response.status(400).json({
            error: 'Bad Request',
            message: 'Token parameter is required',
          });
          return;
        }

        // Query project by public tracking token
        const projectsRef = db.collection('projects');
        const query = projectsRef.where('publicTrackingToken', '==', token);
        const snapshot = await query.limit(1).get();

        if (snapshot.empty) {
          response.status(404).json({
            error: 'Not Found',
            message: 'Project not found with the provided token',
          });
          return;
        }

        const projectDoc = snapshot.docs[0];
        const projectData = projectDoc.data();

        // Extract only safe data for public viewing
        const safeProjectData = {
          projectName: projectData.name || 'Dự án không tên',
          customerName: projectData.customerName || 'Khách hàng không xác định',
          status: projectData.status || 'pending',
          startDate: projectData.startDate,
          endDate: projectData.endDate,
          workflowStages: [],
        };

        // Process workflow stages if they exist
        if (
          projectData.workflowStages &&
          Array.isArray(projectData.workflowStages)
        ) {
          // Sort by order field and extract only safe fields
          safeProjectData.workflowStages = projectData.workflowStages
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((stage) => ({
              processName: stage.processName || 'Công đoạn không xác định',
              status: stage.status || 'pending',
              order: stage.order || 0,
              completionTime: stage.completionTime || null,
              requirement: stage.requirement || null,
              qcImages: stage.qcImages || [],
            }));
        }

        // Return safe project data
        response.status(200).json({
          success: true,
          data: safeProjectData,
        });
      } catch (error) {
        console.error('Error in getProjectStatusByToken:', error);
        response.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
        });
      }
    });
  }
);
