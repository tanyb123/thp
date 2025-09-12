import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  runTransaction,
  documentId,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { getUsers } from './userService';

class SalaryService {
  constructor() {
    this.db = db;
  }

  // ===== QUẢN LÝ CẤU HÌNH HỆ THỐNG =====

  /**
   * Lấy cấu hình hệ thống từ collection 'settings'.
   * @returns {Promise<Object>} - Cấu hình công ty.
   */
  async getSystemSettings() {
    try {
      const settingsRef = doc(this.db, 'settings', 'companyConfig');
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        return settingsDoc.data();
      } else {
        // Trả về giá trị mặc định nếu chưa có cấu hình
        console.warn(
          'Không tìm thấy companyConfig trong Firestore, sử dụng giá trị mặc định.'
        );
        return {
          standardWorkingDays: 26,
          overtimeMultipliers: {
            normal: 1.5,
            sunday: 2.0,
            holiday: 3.0,
          },
        };
      }
    } catch (error) {
      console.error('Lỗi khi lấy cấu hình hệ thống:', error);
      throw error;
    }
  }

  // ===== QUẢN LÝ DỮ LIỆU NHÂN VIÊN =====

  /**
   * Lấy thông tin chi tiết của một nhân viên.
   * @param {string} employeeId - ID của nhân viên.
   * @returns {Promise<Object>} - Dữ liệu chi tiết của nhân viên.
   */
  async getEmployeeDetails(employeeId) {
    try {
      const userRef = doc(this.db, 'users', employeeId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error(`Không tìm thấy nhân viên với ID: ${employeeId}`);
      }
      const userData = userDoc.data();
      return {
        id: userDoc.id,
        ...userData,
        // Đảm bảo các trường quan trọng có giá trị mặc định
        salaryType:
          userData.salaryType || (userData.monthlySalary ? 'monthly' : 'daily'),
        dailySalary: userData.dailySalary || 0,
        monthlySalary: userData.monthlySalary || 0,
        insuranceContributionBase: userData.insuranceContributionBase || 0,
        annualLeaveBalance:
          userData.annualLeaveBalance !== undefined
            ? userData.annualLeaveBalance
            : 12,
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin nhân viên:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách ứng lương đã được duyệt của nhân viên trong tháng.
   * @param {string} employeeId - ID nhân viên.
   * @param {number} month - Tháng (1-12).
   * @param {number} year - Năm.
   * @returns {Promise<Array>} - Danh sách các khoản ứng lương.
   */
  async getAdvancePayments(employeeId, month, year) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      console.log('DEBUG getAdvancePayments:', {
        employeeId,
        month,
        year,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const advanceRef = collection(this.db, 'advance_requests');
      const q = query(
        advanceRef,
        where('userId', '==', employeeId),
        where('status', '==', 'approved')
      );

      const querySnapshot = await getDocs(q);
      const allDocs = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log('DEBUG all approved advances:', allDocs);

      // Filter by date range manually since Firestore date queries can be tricky
      const filteredDocs = allDocs.filter((doc) => {
        const requestDate = doc.requestDate?.toDate
          ? doc.requestDate.toDate()
          : new Date(doc.requestDate);
        return requestDate >= startDate && requestDate <= endDate;
      });

      console.log('DEBUG filtered advances for period:', filteredDocs);
      return filteredDocs;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách ứng lương:', error);
      return [];
    }
  }

  /**
   * Đọc cache báo cáo tổng lương trong Firestore nếu có
   */
  async getCachedSalaryReport(month, year) {
    try {
      const id = `${year}-${String(month).padStart(2, '0')}`;
      const ref = doc(this.db, 'salaryReportCache', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        return data?.payload || null;
      }
      return null;
    } catch (e) {
      console.warn('Không đọc được cache báo cáo:', e);
      return null;
    }
  }

  /**
   * Lưu cache báo cáo tổng lương vào Firestore
   */
  async saveSalaryReportCache(month, year, reportPayload) {
    try {
      const id = `${year}-${String(month).padStart(2, '0')}`;
      const ref = doc(this.db, 'salaryReportCache', id);
      await setDoc(ref, {
        month,
        year,
        payload: reportPayload,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Không lưu được cache báo cáo:', e);
    }
  }

  /**
   * Lấy báo cáo tổng lương cho tất cả nhân viên trong tháng (tính từ dữ liệu gốc)
   * @param {number} month - Tháng (1-12)
   * @param {number} year - Năm
   * @returns {Promise<Object>} - Báo cáo tổng lương
   */
  async getTotalSalaryReport(month, year, options = {}) {
    try {
      const { forceRefresh = false } = options;
      console.log('DEBUG getTotalSalaryReport:', { month, year, forceRefresh });

      if (!forceRefresh) {
        const cached = await this.getCachedSalaryReport(month, year);
        if (cached) {
          return cached;
        }
      }

      // 1) Fetch all users
      const usersRef = collection(this.db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const allUsers = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 2) For each user, try to get the latest salary slip in that month/year
      const resolvedReports = [];
      for (const user of allUsers) {
        try {
          const slipsQ = query(
            collection(this.db, 'salarySlips'),
            where('employeeId', '==', user.id),
            where('month', '==', parseInt(month)),
            where('year', '==', parseInt(year)),
            orderBy('createdAt', 'desc')
          );
          const slipsSnap = await getDocs(slipsQ);
          if (!slipsSnap.empty) {
            // Use the latest slip as ground truth
            const latestSlip = {
              id: slipsSnap.docs[0].id,
              ...slipsSnap.docs[0].data(),
            };
            resolvedReports.push({
              employeeId: latestSlip.employeeId,
              employeeName: latestSlip.employeeName,
              position: user.position || 'Nhân viên',
              attendanceSummary: latestSlip.attendanceSummary,
              calculatedSalary: latestSlip.calculatedSalary,
              source: 'slip',
            });
            continue;
          }

          // 3) If no slip exists, compute from raw data (fallback)
          const attendance = await this.getEmployeeAttendance(
            user.id,
            month,
            year
          );
          const advancePayments = await this.getAdvancePayments(
            user.id,
            month,
            year
          );

          const monthlySalary = Number(user.monthlySalary) || 0;
          const dailySalaryRate = Number(user.dailySalary) || 0;
          const baseSalary =
            monthlySalary > 0 ? monthlySalary : dailySalaryRate * 26;
          const effectiveDays = Number(attendance.effectiveWorkingDays) || 0;
          const baseSalaryForMonth =
            monthlySalary > 0
              ? (monthlySalary / 26) * effectiveDays
              : dailySalaryRate * effectiveDays;

          const hourlyRate =
            baseSalaryForMonth > 0 ? baseSalaryForMonth / 8 : 0;
          const overtimePay = {
            normal:
              (Number(attendance.overtimeHours.normal) || 0) * hourlyRate * 1.5,
            sunday:
              (Number(attendance.overtimeHours.sunday) || 0) * hourlyRate * 1.5,
            holiday:
              (Number(attendance.overtimeHours.holiday) || 0) *
              hourlyRate *
              1.5,
          };
          const totalOvertimePay =
            overtimePay.normal + overtimePay.sunday + overtimePay.holiday;

          const insuranceBase =
            Number(user.insuranceContributionBase) || baseSalary;
          const autoDeductions = await this.getAutoDeductions(insuranceBase);
          const totalAutoDeductions = autoDeductions.reduce(
            (s, d) => s + (Number(d.amount) || 0),
            0
          );
          const totalAdvancePayments = advancePayments.reduce(
            (s, p) => s + (Number(p.amount) || 0),
            0
          );

          const grossSalary = baseSalaryForMonth + totalOvertimePay;
          const totalDeductions = totalAutoDeductions + totalAdvancePayments;
          const netSalary = Math.max(0, grossSalary - totalDeductions);

          resolvedReports.push({
            employeeId: user.id,
            employeeName: user.displayName || user.email || 'Nhân viên',
            position: user.position || 'Nhân viên',
            attendanceSummary: attendance,
            calculatedSalary: {
              baseSalary: baseSalaryForMonth,
              totalOvertimePay,
              grossSalary,
              totalDeductions,
              netSalary,
              autoDeductions,
              advancePayments,
            },
            source: 'computed',
          });
        } catch (e) {
          console.error('Report item error for user', user.id, e);
        }
      }

      // Normalize per-entry totals to avoid mismatch
      const normalizedReports = resolvedReports.map((r) => {
        const gross = Number(r.calculatedSalary?.grossSalary) || 0;
        const net = Number(r.calculatedSalary?.netSalary) || 0;
        let totalDeductions = Number(r.calculatedSalary?.totalDeductions);
        if (
          !Number.isFinite(totalDeductions) ||
          Math.abs(gross - totalDeductions - net) > 1
        ) {
          totalDeductions = Math.max(0, gross - net);
        }
        return {
          ...r,
          calculatedSalary: {
            ...r.calculatedSalary,
            grossSalary: gross,
            netSalary: net,
            totalDeductions,
          },
        };
      });

      // 4) Aggregate totals
      const totalGrossSalary = normalizedReports.reduce(
        (s, r) => s + (r.calculatedSalary?.grossSalary || 0),
        0
      );
      const totalNetSalary = normalizedReports.reduce(
        (s, r) => s + (r.calculatedSalary?.netSalary || 0),
        0
      );
      const totalDeductions = Math.max(0, totalGrossSalary - totalNetSalary);

      const finalReport = {
        month,
        year,
        totalSalarySlips: normalizedReports.length,
        totalGrossSalary,
        totalDeductions,
        totalNetSalary,
        salarySlips: normalizedReports,
        generatedAt: Date.now(),
      };

      // Lưu cache để lần sau mở ra nhanh
      await this.saveSalaryReportCache(month, year, finalReport);

      return finalReport;
    } catch (error) {
      console.error('Lỗi khi lấy báo cáo tổng lương:', error);
      throw error;
    }
  }

  // ===== NHIỆM VỤ 2: TÁI CẤU TRÚC LOGIC BACKEND =====

  /**
   * (VIẾT LẠI) Tổng hợp dữ liệu chấm công và nghỉ phép của nhân viên trong tháng.
   * @param {string} employeeId - ID nhân viên.
   * @param {number} month - Tháng (1-12).
   * @param {number} year - Năm.
   * @returns {Promise<Object>} - Đối tượng tóm tắt chấm công.
   */
  async getEmployeeAttendance(employeeId, month, year) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // 1. Lấy dữ liệu chấm công từ collection 'attendance'
      const attendanceRef = collection(this.db, 'attendance');
      const attendanceQuery = query(
        attendanceRef,
        where('userId', '==', employeeId),
        where('date', '>=', `${year}-${String(month).padStart(2, '0')}-01`),
        where(
          'date',
          '<=',
          `${year}-${String(month).padStart(2, '0')}-${String(
            endDate.getDate()
          ).padStart(2, '0')}`
        )
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const actualWorkDays = attendanceSnapshot.size;

      // Phân loại giờ tăng ca
      const overtimeHours = { normal: 0, sunday: 0, holiday: 0 };
      // Lấy danh sách ngày lễ trong khoảng tháng
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(
        endDate.getDate()
      ).padStart(2, '0')}`;
      const holidaysRef = collection(this.db, 'holidays');
      const holidaysQuery = query(
        holidaysRef,
        where(documentId(), '>=', startDateStr),
        where(documentId(), '<=', endDateStr)
      );
      const holidaysSnap = await getDocs(holidaysQuery);
      const holidays = holidaysSnap.docs.map((d) => d.id);

      // DEBUG rows collector
      const debugRows = [];
      // OT details per day for frontend breakdown
      const overtimeDetails = [];

      const parseHours = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return null;
        const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h + m / 60;
      };

      // Mốc giờ chuẩn cho ngày thường
      const NORMAL_WORK_END = parseHours('17:30'); // 17h30
      const DEFAULT_OT_END = parseHours('20:30'); // 20h30 (mặc định OT đến 20:30 => 3 giờ)

      attendanceSnapshot.forEach((docItem) => {
        const data = docItem.data();
        let workDateStr = data.date;
        if (
          !workDateStr &&
          typeof docItem.id === 'string' &&
          docItem.id.includes('_')
        ) {
          const parts = docItem.id.split('_');
          const datePart = parts[1];
          if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            workDateStr = datePart;
          }
        }
        if (!workDateStr) return; // không xác định được ngày
        const workDate = new Date(workDateStr);
        const dayOfWeek = workDate.getDay();
        const isHoliday = holidays.includes(workDateStr);

        // Tính số giờ làm việc trong ngày nếu có clockIn/clockOut, fallback 8 giờ
        const inH = parseHours(data.clockIn);
        const outH = parseHours(data.clockOut);
        let workedHours = 0;
        if (inH !== null && outH !== null && outH > inH) {
          workedHours = outH - inH;
        }

        if (isHoliday) {
          // Làm vào ngày lễ: toàn bộ giờ là OT ngày lễ
          overtimeHours.holiday += workedHours > 0 ? workedHours : 8;
          return;
        }

        if (dayOfWeek === 0) {
          // Làm vào Chủ nhật: toàn bộ giờ là OT chủ nhật
          overtimeHours.sunday += workedHours > 0 ? workedHours : 8;
          return;
        }

        // Ngày thường: nếu có cờ tăng ca thì tính OT theo mốc 17:30 -> (overtimeEnd | otEndTime | overtimeTo | otTo | default 20:30)
        // LƯU Ý: KHÔNG dùng clockOut để suy ra OT nếu không có trường OT kết thúc riêng.
        if (data.overtime) {
          // Trường hợp tương thích cũ: nếu overtime là số, hiểu là số giờ OT nhập tay
          const explicitOt =
            typeof data.overtime === 'number' ? data.overtime : null;

          if (explicitOt && explicitOt > 0) {
            overtimeHours.normal += explicitOt;
            overtimeDetails.push({
              date: workDateStr,
              type: 'weekday',
              hours: explicitOt,
              source: 'explicit',
            });
          } else {
            // Ưu tiên giờ kết thúc OT theo các trường riêng; nếu không có, mặc định 20:30
            const otEndCandidates = [
              data.overtimeEnd,
              data.otEndTime,
              data.overtimeTo,
              data.otTo,
            ]
              .map((t) => parseHours(t))
              .filter((v) => v !== null);
            const endH =
              otEndCandidates.length > 0 ? otEndCandidates[0] : DEFAULT_OT_END;
            const startH = NORMAL_WORK_END; // OT bắt đầu từ 17:30
            const computedOt = Math.max(0, endH - startH);
            const finalOt = computedOt > 0 ? computedOt : 3; // fallback: 3 giờ nếu không đủ dữ liệu

            overtimeHours.normal += finalOt;
            overtimeDetails.push({
              date: workDateStr,
              type: 'weekday',
              hours: finalOt,
              start: '17:30',
              end:
                otEndCandidates.length > 0
                  ? data.overtimeEnd ||
                    data.otEndTime ||
                    data.overtimeTo ||
                    data.otTo
                  : '20:30',
              source: otEndCandidates.length > 0 ? 'endField' : 'default2030',
            });
          }
        }
      });

      // 2. Lấy dữ liệu nghỉ phép đã được duyệt từ collection 'leaveRequests'
      const leaveRef = collection(this.db, 'leaveRequests');
      const leaveQuery = query(
        leaveRef,
        where('userId', '==', employeeId),
        where('status', '==', 'approved'),
        where('leaveType', '==', 'paid') // Chỉ tính nghỉ phép có lương
      );
      const leaveSnapshot = await getDocs(leaveQuery);

      let paidLeaveDays = 0;
      leaveSnapshot.forEach((doc) => {
        const leave = doc.data();
        const leaveStart = leave.startDate.toDate();
        const leaveEnd = leave.endDate.toDate();

        // Tính số ngày nghỉ phép trong tháng đang xét
        for (
          let d = new Date(leaveStart);
          d <= leaveEnd;
          d.setDate(d.getDate() + 1)
        ) {
          if (d.getFullYear() === year && d.getMonth() === month - 1) {
            paidLeaveDays++;
          }
        }
      });

      // DEBUG: in ra cách cộng dồn OT theo từng ngày
      try {
        console.log('DEBUG OT MONTH', {
          employeeId,
          month,
          year,
          actualWorkDays,
          paidLeaveDays,
          overtimeHours,
          rows: debugRows,
        });
      } catch (e) {
        // ignore logging errors
      }

      // Tính số ngày công hiệu quả (ngày công thực tế + nghỉ phép)
      const effectiveWorkingDays = actualWorkDays + paidLeaveDays;

      return {
        actualWorkDays,
        paidLeaveDays,
        effectiveWorkingDays,
        overtimeHours,
        overtimeDetails,
      };
    } catch (error) {
      console.error('Lỗi khi tổng hợp dữ liệu chấm công:', error);
      throw error;
    }
  }

  /**
   * (VIẾT LẠI) Tính các khoản khấu trừ tự động (BHXH, BHYT, BHTN).
   * @param {number} insuranceContributionBase - Lương đóng BHXH cố định.
   * @returns {Promise<Array>} - Danh sách các khoản khấu trừ tự động.
   */
  async getAutoDeductions(insuranceContributionBase) {
    if (insuranceContributionBase <= 0) {
      return [];
    }
    // Các tỷ lệ này có thể được chuyển vào 'settings' collection để linh hoạt hơn
    const deductionsConfig = [
      { name: 'Bảo hiểm xã hội (8%)', rate: 0.08 },
      { name: 'Bảo hiểm y tế (1.5%)', rate: 0.015 },
      { name: 'Bảo hiểm thất nghiệp (1%)', rate: 0.01 },
    ];

    return deductionsConfig.map((config) => ({
      name: config.name,
      amount: Math.round(insuranceContributionBase * config.rate),
      isAuto: true,
    }));
  }

  /**
   * (VIẾT LẠI) Thực hiện toàn bộ logic tính toán lương chi tiết.
   * @param {Object} employeeInfo - Thông tin nhân viên (lương tháng, etc.).
   * @param {Object} attendanceSummary - Tóm tắt chấm công từ getEmployeeAttendance.
   * @param {Object} systemSettings - Cấu hình hệ thống (ngày công chuẩn, hệ số OT).
   * @param {Object} manualInputs - Các khoản nhập tay (phụ cấp, thưởng, khấu trừ khác).
   * @returns {Object} - Kết quả tính lương chi tiết.
   */
  calculateSalary(
    employeeInfo,
    attendanceSummary,
    systemSettings,
    manualInputs
  ) {
    const { monthlySalary, dailySalary, salaryType } = employeeInfo;
    const { actualWorkDays, paidLeaveDays, overtimeHours } = attendanceSummary;
    const { standardWorkingDays, overtimeMultipliers } = systemSettings;
    const {
      allowances = [],
      bonuses = [],
      deductions = [],
      advancePayments = [],
    } = manualInputs;

    // 1. Tính ngày công hiệu lực
    const effectiveWorkingDays = actualWorkDays + paidLeaveDays;

    // 2. Tính lương cơ bản theo loại lương
    let baseSalary = 0;
    let hourlyRate = 0;
    if (salaryType === 'daily') {
      baseSalary = (dailySalary || 0) * effectiveWorkingDays;
      hourlyRate = (dailySalary || 0) / 8;
    } else {
      baseSalary = (monthlySalary / standardWorkingDays) * effectiveWorkingDays;
      hourlyRate = monthlySalary / standardWorkingDays / 8;
    }

    // 3. Tính lương tăng ca
    const mNormal = overtimeMultipliers?.normal ?? 1.5;
    const mSunday = mNormal; // Chủ nhật cùng đơn giá OT như ngày thường
    const mHoliday = overtimeMultipliers?.holiday ?? 3.0;

    const overtimeHourlyRate = {
      normal: hourlyRate * mNormal,
      sunday: hourlyRate * mSunday,
      holiday: hourlyRate * mHoliday,
    };

    const overtimePay = {
      normal: overtimeHourlyRate.normal * (overtimeHours.normal || 0),
      sunday: overtimeHourlyRate.sunday * (overtimeHours.sunday || 0),
      holiday: overtimeHourlyRate.holiday * (overtimeHours.holiday || 0),
    };
    const totalOvertimePay =
      (overtimePay.normal || 0) +
      (overtimePay.sunday || 0) +
      (overtimePay.holiday || 0);

    // 4. Tính tổng thu nhập (Gross)
    const totalAllowances = allowances.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const totalBonuses = bonuses.reduce((sum, item) => sum + item.amount, 0);
    const grossSalary =
      baseSalary + totalOvertimePay + totalAllowances + totalBonuses;

    // 5. Tính tổng khấu trừ và lương Net
    const totalManualDeductions = deductions.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const totalAdvancePayments = advancePayments.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    // Các khoản khấu trừ tự động (BHXH...) sẽ được thêm vào sau
    const totalDeductionsBeforeInsurance =
      totalManualDeductions + totalAdvancePayments;
    const netSalaryBeforeInsurance =
      grossSalary - totalDeductionsBeforeInsurance;

    return {
      // Inputs & Base Info
      monthlySalary,
      standardWorkingDays,
      hourlyRate: Math.round(hourlyRate),

      // Attendance & Prorated Salary
      attendanceSummary,
      effectiveWorkingDays,
      baseSalary: Math.round(baseSalary),

      // Overtime
      overtimeMultipliers,
      overtimeHourlyRate: {
        normal: Math.round(overtimeHourlyRate.normal),
        sunday: Math.round(overtimeHourlyRate.sunday),
        holiday: Math.round(overtimeHourlyRate.holiday),
      },
      overtimePay: {
        normal: Math.round(overtimePay.normal),
        sunday: Math.round(overtimePay.sunday),
        holiday: Math.round(overtimePay.holiday),
      },
      totalOvertimePay: Math.round(totalOvertimePay),

      // Incomes
      allowances,
      totalAllowances: Math.round(totalAllowances),
      bonuses,
      totalBonuses: Math.round(totalBonuses),
      grossSalary: Math.round(grossSalary),

      // Deductions
      manualDeductions: deductions,
      totalManualDeductions: Math.round(totalManualDeductions),
      advancePayments,
      totalAdvancePayments: Math.round(totalAdvancePayments),

      // Summary (tạm thời, sẽ được cập nhật lại sau khi có BHXH)
      netSalaryBeforeInsurance: Math.round(netSalaryBeforeInsurance),
    };
  }

  /**
   * (VIẾT LẠI) Hàm điều phối chính, tạo phiếu lương tự động.
   * @param {Object} data - Dữ liệu đầu vào từ client (employeeId, month, year, manual inputs).
   * @returns {Promise<Object>} - Phiếu lương đã tạo.
   */
  async createSalarySlipAuto(data) {
    const {
      employeeId,
      month,
      year,
      allowances = [],
      bonuses = [],
      deductions = [],
      notes = '',
    } = data;

    if (!employeeId || !month || !year) {
      throw new Error('Thông tin nhân viên, tháng, năm là bắt buộc.');
    }

    // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu (cập nhật phép năm)
    return await runTransaction(this.db, async (transaction) => {
      // 1. Lấy cấu hình, thông tin nhân viên, chấm công, và ứng lương
      const systemSettings = await this.getSystemSettings();
      const employeeInfo = await this.getEmployeeDetails(employeeId);
      const attendanceSummary = await this.getEmployeeAttendance(
        employeeId,
        month,
        year
      );
      const advancePayments = await this.getAdvancePayments(
        employeeId,
        month,
        year
      );

      // 2. Tính các khoản khấu trừ BHXH dựa trên insuranceContributionBase
      const autoDeductions = await this.getAutoDeductions(
        employeeInfo.insuranceContributionBase
      );

      // 3. Gọi hàm tính lương với tất cả dữ liệu đã thu thập
      const calculatedSalary = this.calculateSalary(
        employeeInfo,
        attendanceSummary,
        systemSettings,
        { allowances, bonuses, deductions, advancePayments }
      );

      // 4. Hoàn thiện tính toán tổng khấu trừ và lương thực nhận
      const totalAutoDeductions = autoDeductions.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      const totalDeductions =
        calculatedSalary.totalManualDeductions +
        calculatedSalary.totalAdvancePayments +
        totalAutoDeductions;
      const netSalary = calculatedSalary.grossSalary - totalDeductions;

      // Loại bỏ trường tạm thời khỏi calculatedSalary trước khi lưu
      const { netSalaryBeforeInsurance, ...finalCalculatedFields } =
        calculatedSalary;

      // 5. Chuẩn bị dữ liệu để lưu vào Firestore
      const finalSalarySlip = {
        // Metadata
        employeeId,
        employeeName: employeeInfo.displayName || employeeInfo.name,
        month: parseInt(month),
        year: parseInt(year),
        createdAt: serverTimestamp(),
        status: 'pending', // 'pending', 'approved', 'paid'
        notes,

        // Input Data
        employeeInfo: {
          salaryType:
            employeeInfo.salaryType ||
            (employeeInfo.monthlySalary ? 'monthly' : 'daily'),
          dailySalary: employeeInfo.dailySalary || 0,
          monthlySalary: employeeInfo.monthlySalary || 0,
          insuranceContributionBase:
            employeeInfo.insuranceContributionBase || 0,
        },
        manualInputs: {
          allowances,
          bonuses,
          manualDeductions: deductions,
          advancePayments,
        },

        // Calculated Data
        attendanceSummary,
        calculatedSalary: {
          ...finalCalculatedFields,
          autoDeductions,
          totalAutoDeductions: Math.round(totalAutoDeductions),
          totalDeductions: Math.round(totalDeductions),
          netSalary: Math.round(netSalary),
        },
      };

      // 6. Lưu phiếu lương vào collection 'salarySlips'
      const newSlipRef = doc(collection(this.db, 'salarySlips'));
      transaction.set(newSlipRef, finalSalarySlip);

      // 7. Cập nhật lại số phép năm của nhân viên
      const paidLeaveDaysInMonth = attendanceSummary.paidLeaveDays;
      if (paidLeaveDaysInMonth > 0) {
        const userRef = doc(this.db, 'users', employeeId);
        const newBalance =
          (employeeInfo.annualLeaveBalance || 0) - paidLeaveDaysInMonth;
        transaction.update(userRef, { annualLeaveBalance: newBalance });
      }

      return { id: newSlipRef.id, ...finalSalarySlip };
    });
  }

  /**
   * Lấy danh sách phiếu lương (có thể lọc).
   * @param {Object} filters - Bộ lọc (month, year, employeeId, status).
   * @returns {Promise<Array>} - Danh sách phiếu lương.
   */
  async getSalarySlips(filters = {}) {
    try {
      const { month, year, employeeId, status } = filters;
      let q = query(
        collection(this.db, 'salarySlips'),
        orderBy('createdAt', 'desc')
      );

      if (month) q = query(q, where('month', '==', parseInt(month)));
      if (year) q = query(q, where('year', '==', parseInt(year)));
      if (employeeId) q = query(q, where('employeeId', '==', employeeId));
      if (status) q = query(q, where('status', '==', status));

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Lỗi khi lấy danh sách phiếu lương:', error);
      throw error;
    }
  }
}

export default new SalaryService();
