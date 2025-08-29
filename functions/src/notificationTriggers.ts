// Trong file functions/src/notificationTriggers.ts
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Giả định admin đã được khởi tạo ở file index.ts chính
const db = admin.firestore();

export const sendDiscussionNotification = functions
  .region('asia-southeast1')
  .firestore.document('projectDiscussions/{messageId}')
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    if (!messageData) {
      console.log('No data associated with the event');
      return null;
    }

    const {
      projectId,
      userId: senderId,
      userName: senderName,
      message,
      attachments,
    } = messageData;

    // 1. Lấy thông tin dự án để hiển thị tên dự án
    const projectRef = db.collection('projects').doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      console.log(`Project ${projectId} not found.`);
      return null;
    }
    const projectData = projectDoc.data();
    if (!projectData) {
      console.log(`No data for project ${projectId}.`);
      return null;
    }

    const projectName = projectData.name || 'Một dự án';

    // 2. Lấy user theo các role cụ thể thay vì chỉ workers trong dự án
    const rolesToNotify = ['giam_doc', 'pho_giam_doc', 'ky_su', 'thuong_mai'];
    const usersSnapshot = await db
      .collection('users')
      .where('role', 'in', rolesToNotify)
      .get();
    const userIdsByRole = usersSnapshot.docs.map((doc) => doc.id);

    // 3. Lọc ra người gửi
    const recipientsIds = userIdsByRole.filter((id: string) => id !== senderId);
    if (recipientsIds.length === 0) {
      console.log('No recipients to notify.');
      return null;
    }

    // 4. Lấy FCM tokens của những người nhận
    const usersRef = db.collection('users');
    const tokensPromises = recipientsIds.map((id: string) =>
      usersRef.doc(id).get()
    );
    const usersDocs = await Promise.all(tokensPromises);

    const tokens = usersDocs
      .map((doc) => doc.data()?.fcmToken)
      .filter((token) => typeof token === 'string' && token.length > 0);

    if (tokens.length === 0) {
      console.log('No FCM tokens found for recipients.');
      return null;
    }

    // 5. Tạo payload cho notification
    let notificationBody = message || '';
    if (attachments && attachments.length > 0) {
      if (attachments[0].type?.startsWith('image/')) {
        notificationBody = 'đã gửi một ảnh.';
      } else {
        notificationBody = 'đã gửi một tài liệu.';
      }
    } else {
      // Giới hạn độ dài tin nhắn
      if (notificationBody.length > 100) {
        notificationBody = notificationBody.substring(0, 97) + '...';
      }
    }

    const payload = {
      notification: {
        title: `Tin nhắn mới: ${projectName}`,
        body: `${senderName}: ${notificationBody}`,
        sound: 'default',
      },
      data: {
        type: 'project_discussion',
        projectId: projectId,
        projectName: projectName,
      },
    };

    // 6. Gửi notification
    console.log(
      `Sending notification to ${tokens.length} tokens for project ${projectName}.`
    );
    return admin.messaging().sendToDevice(tokens, payload);
  });
