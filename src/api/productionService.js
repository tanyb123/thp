import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';

class ProductionService {
  constructor() {
    this.db = getFirestore();
    this.workSessionsCollection = collection(this.db, 'work_sessions');
    this.projectsCollection = collection(this.db, 'projects');
    this.usersCollection = collection(this.db, 'users');
  }

  /**
   * Bắt đầu một phiên làm việc mới
   * @param {string} workerId - UID của công nhân
   * @param {string} workerName - Tên công nhân
   * @param {string} projectId - ID dự án
   * @param {string} projectName - Tên dự án
   * @param {string} stageId - ID công đoạn
   * @param {string} stageName - Tên công đoạn
   * @returns {Promise<string>} sessionId của phiên làm việc mới
   */
  async startWorkSession(
    workerId,
    workerName,
    projectId,
    projectName,
    stageId,
    stageName
  ) {
    try {
      // Bước 1: Kiểm tra xem worker có session nào đang chạy không
      const runningSession = await this.getRunningSessionForWorker(workerId);

      if (runningSession) {
        console.log(
          'Worker has running session, stopping it first:',
          runningSession.id
        );
        await this.stopWorkSession(runningSession.id);
      }

      // Bước 2: Tạo session mới
      const now = Timestamp.now();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const sessionData = {
        workerId,
        workerName,
        projectId,
        projectName,
        stageId,
        stageName,
        startTime: now,
        endTime: null, // null = đang chạy
        durationInHours: 0,
        isOvertime: this.isOvertimeHour(new Date()),
        date: today,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(this.workSessionsCollection, sessionData);
      console.log('Started new work session:', docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('Error starting work session:', error);
      throw error;
    }
  }

  /**
   * Kết thúc một phiên làm việc
   * @param {string} sessionId - ID của phiên làm việc
   * @returns {Promise<number>} durationInHours của phiên làm việc
   */
  async stopWorkSession(sessionId) {
    try {
      const sessionRef = doc(this.workSessionsCollection, sessionId);
      const now = Timestamp.now();

      // Lấy thông tin session để tính duration
      const sessionDoc = await getDocs(
        query(this.workSessionsCollection, where('__name__', '==', sessionId))
      );

      if (sessionDoc.empty) {
        throw new Error('Session not found');
      }

      const sessionData = sessionDoc.docs[0].data();
      const startTime = sessionData.startTime.toDate();
      const endTime = now.toDate();

      // Tính duration (có xử lý giờ nghỉ trưa)
      const durationInHours = this.calculateWorkDuration(startTime, endTime);

      // Cập nhật session
      const updateData = {
        endTime: now,
        durationInHours,
        updatedAt: now,
      };

      // Loại bỏ các field có giá trị undefined để tránh lỗi Firestore
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );

      await updateDoc(sessionRef, cleanData);

      console.log(
        'Stopped work session:',
        sessionId,
        'Duration:',
        durationInHours,
        'hours'
      );
      return durationInHours;
    } catch (error) {
      console.error('Error stopping work session:', error);
      throw error;
    }
  }

  /**
   * Lấy phiên làm việc đang chạy của một worker
   * @param {string} workerId - UID của công nhân
   * @returns {Promise<Object|null>} Session đang chạy hoặc null
   */
  async getRunningSessionForWorker(workerId) {
    try {
      const q = query(
        this.workSessionsCollection,
        where('workerId', '==', workerId),
        where('endTime', '==', null),
        orderBy('startTime', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      };
    } catch (error) {
      console.error('Error getting running session:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách công việc được giao cho một worker
   * @param {string} workerId - UID của công nhân
   * @returns {Promise<Array>} Danh sách công việc
   */
  async getTasksForWorker(workerId) {
    try {
      // Truy vấn các project stages được assign cho worker này
      const projectsQuery = query(this.projectsCollection);
      const projectsSnapshot = await getDocs(projectsQuery);

      const tasks = [];

      for (const projectDoc of projectsSnapshot.docs) {
        const projectData = projectDoc.data();
        const workflowStages = projectData.workflowStages || [];

        // Lọc các stages được assign cho worker này
        const assignedStages = workflowStages.filter(
          (stage) =>
            stage.assignedWorkers && stage.assignedWorkers.includes(workerId)
        );

        for (const stage of assignedStages) {
          const taskData = {
            projectId: projectDoc.id,
            projectName: projectData.name,
            stageId: stage.stageId,
            stageName: stage.processName,
            stageStatus: stage.status,
            priority: stage.priority || 0,
            // Include media instruction data
            instructionImages: stage.instructionImages || [],
            instructionNotes: stage.instructionNotes || '',
            instructionAudio: stage.instructionAudio || null,
            hasInstructions: !!stage.instructionNotes,
            hasImages: !!(
              stage.instructionImages && stage.instructionImages.length > 0
            ),
            hasAudio: !!stage.instructionAudio,
          };

          // Debug logging
          console.log('ProductionService - Task data for worker:', {
            stageName: taskData.stageName,
            hasInstructions: taskData.hasInstructions,
            hasImages: taskData.hasImages,
            hasAudio: taskData.hasAudio,
            instructionImagesCount: taskData.instructionImages.length,
            instructionNotesLength: taskData.instructionNotes.length,
            instructionAudio: !!taskData.instructionAudio,
          });

          tasks.push(taskData);
        }
      }

      // Sắp xếp theo priority
      tasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      return tasks;
    } catch (error) {
      console.error('Error getting tasks for worker:', error);
      throw error;
    }
  }

  /**
   * Lấy trạng thái live của toàn bộ xưởng
   * @returns {Promise<Array>} Danh sách trạng thái tất cả workers
   */
  async getLiveFactoryStatus() {
    try {
      // Lấy tất cả users có role là worker
      const workersQuery = query(
        this.usersCollection,
        where('role', 'in', [
          'tho_han',
          'tho_co_khi',
          'tho_lap_rap',
          'cong_nhan',
        ])
      );
      const workersSnapshot = await getDocs(workersQuery);

      const factoryStatus = [];

      for (const workerDoc of workersSnapshot.docs) {
        const workerData = workerDoc.data();
        const workerId = workerDoc.id;

        // Lấy session đang chạy của worker này
        const runningSession = await this.getRunningSessionForWorker(workerId);

        // Đếm số công việc mới được giao
        const tasks = await this.getTasksForWorker(workerId);
        const newTasksCount = tasks.filter(
          (task) => task.stageStatus === 'assigned'
        ).length;

        factoryStatus.push({
          workerId,
          workerName: workerData.displayName || workerData.email,
          workerRole: workerData.role,
          avatar: workerData.photoURL,
          status: runningSession ? 'working' : 'idle',
          currentTask: runningSession
            ? {
                projectName: runningSession.projectName,
                stageName: runningSession.stageName,
                startTime: runningSession.startTime,
                duration: this.calculateCurrentDuration(
                  runningSession.startTime.toDate()
                ),
              }
            : null,
          newTasksCount,
          lastActivity: runningSession ? runningSession.startTime : null,
        });
      }

      return factoryStatus;
    } catch (error) {
      console.error('Error getting live factory status:', error);
      throw error;
    }
  }

  /**
   * Subscribe to live factory status changes
   * @param {Function} callback - Callback function to handle updates
   * @returns {Function} Unsubscribe function
   */
  subscribeLiveFactoryStatus(callback) {
    // Subscribe to work_sessions changes
    const unsubscribe = onSnapshot(
      query(this.workSessionsCollection, where('endTime', '==', null)),
      async (snapshot) => {
        try {
          const liveStatus = await this.getLiveFactoryStatus();
          callback(liveStatus);
        } catch (error) {
          console.error('Error in live status subscription:', error);
        }
      }
    );

    return unsubscribe;
  }

  /**
   * Tính toán thời gian làm việc (có xử lý giờ nghỉ trưa)
   * @param {Date} startTime - Thời gian bắt đầu
   * @param {Date} endTime - Thời gian kết thúc
   * @returns {number} Số giờ làm việc
   */
  calculateWorkDuration(startTime, endTime) {
    const diffMs = endTime.getTime() - startTime.getTime();
    let hours = diffMs / (1000 * 60 * 60);

    // Xử lý giờ nghỉ trưa (11:30-13:00)
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    const lunchStartMinutes = 11 * 60 + 30; // 11:30
    const lunchEndMinutes = 13 * 60; // 13:00

    // Nếu thời gian làm việc bắt đầu trước 11:30 và kết thúc sau 13:00
    if (
      startTotalMinutes < lunchStartMinutes &&
      endTotalMinutes > lunchEndMinutes
    ) {
      hours -= 1.5; // Trừ 1.5 giờ nghỉ trưa
    }
    // Nếu bắt đầu trong giờ nghỉ trưa
    else if (
      startTotalMinutes >= lunchStartMinutes &&
      startTotalMinutes < lunchEndMinutes
    ) {
      const minutesInLunch = Math.min(
        lunchEndMinutes - startTotalMinutes,
        endTotalMinutes - startTotalMinutes
      );
      if (minutesInLunch > 0) {
        hours -= minutesInLunch / 60;
      }
    }
    // Nếu kết thúc trong giờ nghỉ trưa
    else if (
      endTotalMinutes > lunchStartMinutes &&
      endTotalMinutes <= lunchEndMinutes
    ) {
      const minutesInLunch = Math.min(
        endTotalMinutes - lunchStartMinutes,
        endTotalMinutes - startTotalMinutes
      );
      if (minutesInLunch > 0) {
        hours -= minutesInLunch / 60;
      }
    }

    return Math.max(0, parseFloat(hours.toFixed(2)));
  }

  /**
   * Tính toán thời gian hiện tại từ khi bắt đầu
   * @param {Date} startTime - Thời gian bắt đầu
   * @returns {string} Formatted duration string
   */
  calculateCurrentDuration(startTime) {
    const now = new Date();
    const duration = this.calculateWorkDuration(startTime, now);

    const hours = Math.floor(duration);
    const minutes = Math.round((duration - hours) * 60);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:00`;
  }

  /**
   * Kiểm tra có phải giờ tăng ca không
   * @param {Date} time - Thời gian cần kiểm tra
   * @returns {boolean} True nếu là giờ tăng ca
   */
  isOvertimeHour(time) {
    const hour = time.getHours();
    const minute = time.getMinutes();

    // Tăng ca nếu sau 17:30 hoặc trước 7:00
    return hour > 17 || (hour === 17 && minute >= 30) || hour < 7;
  }

  /**
   * Lấy work sessions theo ngày
   * @param {string} date - Ngày theo format YYYY-MM-DD
   * @returns {Promise<Array>} Danh sách work sessions
   */
  async getWorkSessionsByDate(date) {
    try {
      const q = query(
        this.workSessionsCollection,
        where('date', '==', date),
        orderBy('startTime', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const sessions = [];

      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return sessions;
    } catch (error) {
      console.error('Error getting work sessions by date:', error);
      throw error;
    }
  }
}

export default new ProductionService();
