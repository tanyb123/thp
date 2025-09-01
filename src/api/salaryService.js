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
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// Import các service hiện có
import { getUsers } from './userService';
import { getAttendanceHistory } from './attendanceService';

/**
 * Service quản lý phiếu lương và các thành phần liên quan
 */
class SalaryService {
  constructor() {
    this.db = db;
  }

  // ===== QUẢN LÝ LOẠI PHÍ CỐ ĐỊNH =====

  /**
   * Tạo loại phí cố định mới
   * @param {Object} feeData - Dữ liệu loại phí
   * @returns {Promise<Object>} - Loại phí đã tạo
   */
  async createFixedFee(feeData) {
    try {
      const { name, type, amount, description, isActive = true } = feeData;

      if (!name || !type || amount === undefined) {
        throw new Error('Tên, loại và số tiền là bắt buộc');
      }

      const feeRef = collection(this.db, 'fixedFees');
      const docRef = await addDoc(feeRef, {
        name,
        type, // 'deduction' | 'allowance' | 'insurance'
        amount: parseFloat(amount),
        description: description || '',
        isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'system', // Có thể thay bằng user ID
      });

      return {
        id: docRef.id,
        ...feeData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Lỗi khi tạo loại phí cố định:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách tất cả loại phí cố định
   * @returns {Promise<Array>} - Danh sách loại phí
   */
  async getAllFixedFees() {
    try {
      const feesRef = collection(this.db, 'fixedFees');
      const q = query(feesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      }));
    } catch (error) {
      console.error('Lỗi khi lấy danh sách loại phí:', error);
      throw error;
    }
  }

  /**
   * Cập nhật loại phí cố định
   * @param {string} feeId - ID loại phí
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Loại phí đã cập nhật
   */
  async updateFixedFee(feeId, updateData) {
    try {
      const feeRef = doc(this.db, 'fixedFees', feeId);
      const updatePayload = {
        ...updateData,
        updatedAt: serverTimestamp(),
      };

      if (updateData.amount !== undefined) {
        updatePayload.amount = parseFloat(updateData.amount);
      }

      await updateDoc(feeRef, updatePayload);

      const updatedDoc = await getDoc(feeRef);
      return {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        createdAt: updatedDoc.data().createdAt?.toDate(),
        updatedAt: updatedDoc.data().updatedAt?.toDate(),
      };
    } catch (error) {
      console.error('Lỗi khi cập nhật loại phí:', error);
      throw error;
    }
  }

  /**
   * Xóa loại phí cố định
   * @param {string} feeId - ID loại phí
   * @returns {Promise<boolean>} - Kết quả xóa
   */
  async deleteFixedFee(feeId) {
    try {
      await deleteDoc(doc(this.db, 'fixedFees', feeId));
      return true;
    } catch (error) {
      console.error('Lỗi khi xóa loại phí:', error);
      throw error;
    }
  }

  // ===== QUẢN LÝ PHIẾU LƯƠNG =====

  /**
   * Tạo phiếu lương mới
   * @param {Object} salaryData - Dữ liệu phiếu lương
   * @returns {Promise<Object>} - Phiếu lương đã tạo
   */
  async createSalarySlip(salaryData) {
    try {
      const {
        employeeId,
        employeeName,
        month,
        year,
        dailySalary,
        monthlySalary,
        workingDays,
        overtimeDays,
        deductions = [],
        allowances = [],
        advancePayments = [],
        bonuses = [],
        notes = '',
      } = salaryData;

      if (!employeeId || !month || !year) {
        throw new Error('Thông tin nhân viên, tháng, năm là bắt buộc');
      }

      // Kiểm tra ít nhất phải có dailySalary hoặc monthlySalary
      if (
        (!dailySalary || dailySalary <= 0) &&
        (!monthlySalary || monthlySalary <= 0)
      ) {
        throw new Error(
          'Phải có lương theo ngày hoặc lương cố định theo tháng'
        );
      }

      // Tính toán lương
      const calculatedSalary = this.calculateSalary({
        dailySalary,
        monthlySalary,
        workingDays,
        overtimeDays,
        deductions,
        allowances,
        advancePayments,
        bonuses,
      });

      const salaryRef = collection(this.db, 'salarySlips');
      const docRef = await addDoc(salaryRef, {
        employeeId,
        employeeName,
        month: parseInt(month),
        year: parseInt(year),
        dailySalary: parseFloat(dailySalary || 0),
        monthlySalary: parseFloat(monthlySalary || 0),
        workingDays: parseInt(workingDays),
        overtimeDays: parseFloat(overtimeDays || 0),
        deductions: deductions.map((d) => ({
          ...d,
          amount: parseFloat(d.amount),
        })),
        allowances: allowances.map((a) => ({
          ...a,
          amount: parseFloat(a.amount),
        })),
        advancePayments: advancePayments.map((ap) => ({
          ...ap,
          amount: parseFloat(ap.amount),
        })),
        bonuses: bonuses.map((b) => ({
          ...b,
          amount: parseFloat(b.amount),
        })),
        notes,
        calculatedSalary,
        status: 'pending', // pending, approved, paid
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'system', // Có thể thay bằng user ID
      });

      return {
        id: docRef.id,
        ...salaryData,
        calculatedSalary,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Lỗi khi tạo phiếu lương:', error);
      throw error;
    }
  }

  /**
   * Tính toán lương
   * @param {Object} salaryData - Dữ liệu lương
   * @returns {Object} - Kết quả tính toán
   */
  calculateSalary(salaryData) {
    const {
      dailySalary,
      monthlySalary,
      workingDays,
      overtimeDays = 0,
      deductions = [],
      allowances = [],
      advancePayments = [],
      bonuses = [],
    } = salaryData;

    let baseSalary = 0;

    // Nếu có lương cố định theo tháng thì dùng cái đó
    if (monthlySalary && monthlySalary > 0) {
      baseSalary = monthlySalary;
    }
    // Nếu không có lương cố định thì tính theo ngày
    else if (dailySalary && dailySalary > 0) {
      baseSalary = dailySalary * workingDays;
    }

    // Lương tăng ca: dailySalary × 1.5 × overtimeDays (chỉ áp dụng nếu có lương ngày)
    const overtimeSalary =
      dailySalary && dailySalary > 0 ? dailySalary * 1.5 * overtimeDays : 0;

    // Tổng phụ cấp
    const totalAllowances = allowances.reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0
    );

    // Tổng thưởng
    const totalBonuses = bonuses.reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0
    );

    // Tổng khấu trừ
    const totalDeductions = deductions.reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0
    );

    // Tổng ứng lương
    const totalAdvancePayments = advancePayments.reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0
    );

    // Lương thực nhận
    const grossSalary =
      baseSalary + overtimeSalary + totalAllowances + totalBonuses;
    const netSalary = grossSalary - totalDeductions - totalAdvancePayments;

    return {
      dailySalary: parseFloat(dailySalary || 0),
      monthlySalary: parseFloat(monthlySalary || 0),
      baseSalary: parseFloat(baseSalary.toFixed(0)),
      salaryByDays: parseFloat((dailySalary * workingDays || 0).toFixed(0)),
      overtimeSalary: parseFloat(overtimeSalary.toFixed(0)),
      totalAllowances: parseFloat(totalAllowances.toFixed(0)),
      totalBonuses: parseFloat(totalBonuses.toFixed(0)),
      totalDeductions: parseFloat(totalDeductions.toFixed(0)),
      totalAdvancePayments: parseFloat(totalAdvancePayments.toFixed(0)),
      grossSalary: parseFloat(grossSalary.toFixed(0)),
      netSalary: parseFloat(netSalary.toFixed(0)),
    };
  }

  /**
   * Lấy danh sách phiếu lương
   * @param {Object} filters - Bộ lọc
   * @returns {Promise<Array>} - Danh sách phiếu lương
   */
  async getSalarySlips(filters = {}) {
    try {
      const { month, year, employeeId, status } = filters;
      const salaryRef = collection(this.db, 'salarySlips');

      let q = query(salaryRef, orderBy('createdAt', 'desc'));

      if (month !== undefined) {
        q = query(q, where('month', '==', parseInt(month)));
      }

      if (year !== undefined) {
        q = query(q, where('year', '==', parseInt(year)));
      }

      if (employeeId) {
        q = query(q, where('employeeId', '==', employeeId));
      }

      if (status) {
        q = query(q, where('status', '==', status));
      }

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      }));
    } catch (error) {
      console.error('Lỗi khi lấy danh sách phiếu lương:', error);
      throw error;
    }
  }

  /**
   * Lấy phiếu lương theo ID
   * @param {string} salaryId - ID phiếu lương
   * @returns {Promise<Object>} - Phiếu lương
   */
  async getSalarySlipById(salaryId) {
    try {
      const salaryRef = doc(this.db, 'salarySlips', salaryId);
      const salaryDoc = await getDoc(salaryRef);

      if (!salaryDoc.exists()) {
        throw new Error('Phiếu lương không tồn tại');
      }

      return {
        id: salaryDoc.id,
        ...salaryDoc.data(),
        createdAt: salaryDoc.data().createdAt?.toDate(),
        updatedAt: salaryDoc.data().updatedAt?.toDate(),
      };
    } catch (error) {
      console.error('Lỗi khi lấy phiếu lương:', error);
      throw error;
    }
  }

  /**
   * Cập nhật phiếu lương
   * @param {string} salaryId - ID phiếu lương
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Phiếu lương đã cập nhật
   */
  async updateSalarySlip(salaryId, updateData) {
    try {
      const salaryRef = doc(this.db, 'salarySlips', salaryId);

      // Nếu có thay đổi dữ liệu lương, tính toán lại
      if (
        updateData.dailySalary ||
        updateData.monthlySalary ||
        updateData.workingDays ||
        updateData.overtimeDays ||
        updateData.deductions ||
        updateData.allowances ||
        updateData.advancePayments ||
        updateData.bonuses
      ) {
        const currentData = await this.getSalarySlipById(salaryId);
        const newData = { ...currentData, ...updateData };

        const calculatedSalary = this.calculateSalary(newData);
        updateData.calculatedSalary = calculatedSalary;
      }

      const updatePayload = {
        ...updateData,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(salaryRef, updatePayload);

      return await this.getSalarySlipById(salaryId);
    } catch (error) {
      console.error('Lỗi khi cập nhật phiếu lương:', error);
      throw error;
    }
  }

  /**
   * Xóa phiếu lương
   * @param {string} salaryId - ID phiếu lương
   * @returns {Promise<boolean>} - Kết quả xóa
   */
  async deleteSalarySlip(salaryId) {
    try {
      await deleteDoc(doc(this.db, 'salarySlips', salaryId));
      return true;
    } catch (error) {
      console.error('Lỗi khi xóa phiếu lương:', error);
      throw error;
    }
  }

  // ===== QUẢN LÝ ỨNG LƯƠNG =====

  /**
   * Lấy danh sách ứng lương của nhân viên
   * @param {string} employeeId - ID nhân viên
   * @param {number} month - Tháng
   * @param {number} year - Năm
   * @returns {Promise<Array>} - Danh sách ứng lương
   */
  async getAdvancePayments(employeeId, month, year) {
    try {
      const advanceRef = collection(this.db, 'advanceSalaryRequests');
      const q = query(
        advanceRef,
        where('userId', '==', employeeId),
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const advances = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      }));

      // Lọc theo tháng/năm nếu có
      if (month && year) {
        return advances.filter((advance) => {
          const advanceDate = advance.createdAt;
          return (
            advanceDate.getMonth() + 1 === month &&
            advanceDate.getFullYear() === year
          );
        });
      }

      return advances;
    } catch (error) {
      console.error('Lỗi khi lấy danh sách ứng lương:', error);
      throw error;
    }
  }

  // ===== QUẢN LÝ CHẤM CÔNG =====

  /**
   * Lấy thông tin chấm công của nhân viên theo tháng
   * @param {string} employeeId - ID nhân viên
   * @param {number} month - Tháng
   * @param {number} year - Năm
   * @returns {Promise<Object>} - Thông tin chấm công
   */
  async getEmployeeAttendance(employeeId, month, year) {
    try {
      // Query trực tiếp từ Firestore để đảm bảo lấy được dữ liệu đúng
      const attendanceRef = collection(this.db, 'attendance');

      // Tạo range date cho tháng
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Ngày cuối cùng của tháng

      // Format dates để tìm documents
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(
        endDate.getDate()
      ).padStart(2, '0')}`;

      // Lấy tất cả documents và filter theo date range
      const querySnapshot = await getDocs(attendanceRef);
      const attendanceRecords = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // Kiểm tra xem document có thuộc user này không
        if (data.userId === employeeId || doc.id.startsWith(employeeId + '_')) {
          // Trích xuất ngày từ document ID (format: userId_YYYY-MM-DD)
          let docDate = data.date;
          if (!docDate && doc.id.includes('_')) {
            const datePart = doc.id.split('_')[1];
            if (datePart && datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
              docDate = datePart;
            }
          }

          // Kiểm tra xem document có thuộc tháng cần tìm không
          if (docDate && docDate >= startDateStr && docDate <= endDateStr) {
            attendanceRecords.push({
              id: doc.id,
              ...data,
              clockIn: data.clockIn,
              clockOut: data.clockOut,
              overtime: data.overtime || 0,
              date: docDate,
            });
          }
        }
      });

      // Sắp xếp theo ngày
      attendanceRecords.sort((a, b) => a.date.localeCompare(b.date));

      // Debug log để kiểm tra
      console.log('getEmployeeAttendance Debug:', {
        employeeId,
        month,
        year,
        startDateStr,
        endDateStr,
        totalRecords: querySnapshot.size,
        filteredRecords: attendanceRecords.length,
        records: attendanceRecords.map((r) => ({
          date: r.date,
          clockIn: !!r.clockIn,
          clockOut: !!r.clockOut,
          overtime: r.overtime,
          userId: r.userId,
        })),
      });

      // Debug chi tiết từng record
      console.log('=== DETAILED RECORDS ===');
      attendanceRecords.forEach((record, index) => {
        console.log(`Record ${index + 1}:`, {
          date: record.date,
          clockIn: record.clockIn,
          clockOut: record.clockOut,
          overtime: record.overtime,
          userId: record.userId,
          hasClockIn: !!record.clockIn,
          hasClockOut: !!record.clockOut,
        });
      });

      if (!attendanceRecords || attendanceRecords.length === 0) {
        return {
          attendances: [],
          totalDays: 0,
          workingDays: 0,
          totalOvertime: 0,
          month,
          year,
        };
      }

      // Tính toán tổng hợp
      const totalDays = attendanceRecords.length;

      // Total Days chính là số ngày công (công nhân đi làm)
      const workingDays = totalDays;

      // Tính overtime: chỉ lấy từ overtime field nếu có
      const totalOvertime = attendanceRecords.reduce((sum, att) => {
        return sum + (att.overtime || 0);
      }, 0);

      return {
        attendances: attendanceRecords,
        totalDays,
        workingDays,
        totalOvertime,
        month,
        year,
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin chấm công:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách tất cả nhân viên
   * @returns {Promise<Array>} - Danh sách nhân viên
   */
  async getAllEmployees() {
    try {
      const users = await getUsers();

      // Lọc chỉ lấy nhân viên có role công nhân, kỹ sư, kế toán
      const employees = users.filter((user) =>
        ['cong_nhan', 'ky_su', 'ke_toan'].includes(user.role?.toLowerCase())
      );

      return employees.map((user) => ({
        id: user.uid || user.id,
        name: user.displayName || user.name || user.email,
        email: user.email,
        role: user.role,
        // basicSalary: user.basicSalary || 0, // Đã thay bằng dailySalary và monthlySalary
        dailySalary: user.dailySalary || 0,
        monthlySalary: user.monthlySalary || 0,
      }));
    } catch (error) {
      console.error('Lỗi khi lấy danh sách nhân viên:', error);
      throw error;
    }
  }

  /**
   * Lấy thông tin lương cơ bản của nhân viên
   * @param {string} employeeId - ID nhân viên
   * @returns {Promise<Object>} - Thông tin lương
   */
  async getEmployeeSalaryInfo(employeeId) {
    try {
      const users = await getUsers();
      const employee = users.find(
        (user) => (user.uid || user.id) === employeeId
      );

      if (!employee) {
        throw new Error('Không tìm thấy nhân viên');
      }

      return {
        // basicSalary: employee.basicSalary || 0, // Đã thay bằng dailySalary và monthlySalary
        dailySalary: employee.dailySalary || 0,
        monthlySalary: employee.monthlySalary || 0,
        role: employee.role,
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin lương nhân viên:', error);
      throw error;
    }
  }

  /**
   * Tự động tạo phiếu lương từ dữ liệu có sẵn
   * @param {Object} salaryData - Dữ liệu phiếu lương
   * @returns {Promise<Object>} - Phiếu lương đã tạo
   */
  async createSalarySlipAuto(salaryData) {
    try {
      const {
        employeeId,
        month,
        year,
        deductions = [],
        allowances = [],
        bonuses = [],
        notes = '',
      } = salaryData;

      if (!employeeId || !month || !year) {
        throw new Error('Thông tin nhân viên, tháng, năm là bắt buộc');
      }

      // 1. Lấy thông tin nhân viên và lương cơ bản
      const employeeInfo = await this.getEmployeeSalaryInfo(employeeId);
      const users = await getUsers();
      const employee = users.find(
        (user) => (user.uid || user.id) === employeeId
      );

      if (!employee) {
        throw new Error('Không tìm thấy nhân viên');
      }

      // 2. Lấy thông tin chấm công tự động
      const attendanceInfo = await this.getEmployeeAttendance(
        employeeId,
        month,
        year
      );

      // 3. Lấy ứng lương tự động
      const advancePayments = await this.getAdvancePayments(
        employeeId,
        month,
        year
      );

      // 4. Tạo dữ liệu phiếu lương
      const salaryDataComplete = {
        employeeId,
        employeeName: employee.displayName || employee.name || employee.email,
        month: parseInt(month),
        year: parseInt(year),
        dailySalary: employeeInfo.dailySalary, // Sử dụng dailySalary từ User Management
        monthlySalary: employeeInfo.monthlySalary, // Sử dụng monthlySalary từ User Management
        workingDays: attendanceInfo.workingDays,
        overtimeDays: attendanceInfo.totalOvertime, // Số ngày tăng ca
        deductions: [], // Không cần nhập manual, sẽ tự động lấy từ FixedFees
        allowances,
        advancePayments,
        bonuses,
        notes,
      };

      // 5. Tạo phiếu lương
      const salarySlip = await this.createSalarySlip(salaryDataComplete);

      // 6. Tự động thêm bảo hiểm và phụ phí cố định
      const grossSalary = salarySlip.calculatedSalary.grossSalary;
      const autoDeductions = await this.getAutoDeductions(grossSalary);

      if (autoDeductions.length > 0) {
        // Cập nhật phiếu lương với khấu trừ tự động
        const updatedDeductions = [...autoDeductions];
        const updatedSalarySlip = await this.updateSalarySlip(salarySlip.id, {
          deductions: updatedDeductions,
        });

        // Tính lại lương sau khi trừ bảo hiểm
        const recalculatedSalary = this.calculateSalary({
          ...salaryDataComplete,
          deductions: updatedDeductions,
        });

        // Cập nhật lương đã tính lại
        await this.updateSalarySlip(salarySlip.id, {
          calculatedSalary: recalculatedSalary,
        });

        return { ...updatedSalarySlip, calculatedSalary: recalculatedSalary };
      }

      return salarySlip;
    } catch (error) {
      console.error('Lỗi khi tạo phiếu lương tự động:', error);
      throw error;
    }
  }

  // ===== XUẤT EXCEL =====

  /**
   * Tạo dữ liệu Excel cho phiếu lương
   * @param {Object} salarySlip - Phiếu lương
   * @returns {Object} - Dữ liệu Excel
   */
  prepareExcelData(salarySlip) {
    const {
      employeeName,
      month,
      year,
      dailySalary,
      monthlySalary,
      workingDays,
      overtimeDays,
      deductions,
      allowances,
      advancePayments,
      bonuses,
      calculatedSalary,
      notes,
    } = salarySlip;

    const monthNames = [
      'Tháng 1',
      'Tháng 2',
      'Tháng 3',
      'Tháng 4',
      'Tháng 5',
      'Tháng 6',
      'Tháng 7',
      'Tháng 8',
      'Tháng 9',
      'Tháng 10',
      'Tháng 11',
      'Tháng 12',
    ];

    return {
      fileName: `Phiếu lương - ${employeeName} - ${
        monthNames[month - 1]
      } ${year}.xlsx`,
      data: {
        employeeInfo: {
          'Tên nhân viên': employeeName,
          Tháng: monthNames[month - 1],
          Năm: year,
        },
        salaryDetails: {
          'Lương theo ngày': dailySalary
            ? dailySalary.toLocaleString('vi-VN') + ' VNĐ'
            : 'N/A',
          'Lương cố định tháng': monthlySalary
            ? monthlySalary.toLocaleString('vi-VN') + ' VNĐ'
            : 'N/A',
          'Số ngày công': workingDays,
          'Số ngày tăng ca': overtimeDays,
          'Lương theo ngày':
            calculatedSalary.salaryByDays.toLocaleString('vi-VN') + ' VNĐ',
          'Lương tăng ca':
            calculatedSalary.overtimeSalary.toLocaleString('vi-VN') + ' VNĐ',
        },
        additions: {
          'Phụ cấp': allowances
            .map((a) => `${a.name}: ${a.amount.toLocaleString('vi-VN')} VNĐ`)
            .join('\n'),
          Thưởng: bonuses
            .map((b) => `${b.name}: ${b.amount.toLocaleString('vi-VN')} VNĐ`)
            .join('\n'),
          'Tổng cộng':
            calculatedSalary.totalAllowances.toLocaleString('vi-VN') + ' VNĐ',
        },
        deductions: {
          'Khấu trừ': deductions
            .map((d) => `${d.name}: ${d.amount.toLocaleString('vi-VN')} VNĐ`)
            .join('\n'),
          'Ứng lương': advancePayments
            .map(
              (ap) => `${ap.reason}: ${ap.amount.toLocaleString('vi-VN')} VNĐ`
            )
            .join('\n'),
          'Tổng cộng':
            calculatedSalary.totalDeductions.toLocaleString('vi-VN') + ' VNĐ',
        },
        summary: {
          'Tổng lương gộp':
            calculatedSalary.grossSalary.toLocaleString('vi-VN') + ' VNĐ',
          'Tổng khấu trừ':
            calculatedSalary.totalDeductions.toLocaleString('vi-VN') + ' VNĐ',
          'Lương thực nhận':
            calculatedSalary.netSalary.toLocaleString('vi-VN') + ' VNĐ',
        },
        notes: notes || 'Không có ghi chú',
      },
    };
  }

  /**
   * Debug function để kiểm tra dữ liệu attendance
   * @param {string} employeeId - ID nhân viên
   * @param {number} month - Tháng
   * @param {number} year - Năm
   */
  async debugAttendanceData(employeeId, month, year) {
    try {
      console.log('=== DEBUG ATTENDANCE DATA ===');
      console.log('Employee ID:', employeeId);
      console.log('Month:', month);
      console.log('Year:', year);

      // Lấy tất cả documents từ collection attendance
      const attendanceRef = collection(this.db, 'attendance');
      const querySnapshot = await getDocs(attendanceRef);

      console.log('Total attendance documents:', querySnapshot.size);

      // Tìm documents của employee này
      const employeeDocs = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === employeeId || doc.id.startsWith(employeeId + '_')) {
          employeeDocs.push({
            id: doc.id,
            userId: data.userId,
            date: data.date,
            clockIn: data.clockIn,
            clockOut: data.clockOut,
            overtime: data.overtime,
          });
        }
      });

      console.log('Employee documents found:', employeeDocs.length);
      console.log('Employee documents:', employeeDocs);

      return employeeDocs;
    } catch (error) {
      console.error('Debug attendance error:', error);
      return [];
    }
  }

  /**
   * Lấy bảo hiểm và phụ phí cố định để tự động trừ vào lương
   * @param {number} grossSalary - Tổng lương gộp (trước khi trừ bảo hiểm)
   * @returns {Promise<Array>} - Danh sách khấu trừ tự động
   */
  async getAutoDeductions(grossSalary) {
    try {
      const fixedFees = await this.getAllFixedFees();
      const autoDeductions = [];

      fixedFees.forEach((fee) => {
        if (fee.isActive && fee.type === 'deduction') {
          let amount = 0;

          if (fee.calculationType === 'percentage') {
            // Tính theo % lương (ví dụ: BHXH 8%)
            amount = (grossSalary * fee.percentage) / 100;
          } else if (fee.calculationType === 'fixed') {
            // Số tiền cố định
            amount = fee.amount;
          }

          if (amount > 0) {
            autoDeductions.push({
              name: fee.name,
              amount: parseFloat(amount.toFixed(0)),
              percentage: fee.percentage || null,
              isAuto: true,
              description: fee.description,
            });
          }
        }
      });

      return autoDeductions;
    } catch (error) {
      console.error('Lỗi khi lấy khấu trừ tự động:', error);
      return [];
    }
  }
}

export default new SalaryService();
