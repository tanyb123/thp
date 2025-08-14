import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  startOf,
  endOf,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { getTotalMonthlyFixedCosts } from './fixedCostService';
import { getMaterialPriceByName } from './materialService';
import {
  getExpensesInMonth,
  deleteExpensesByProjectId,
} from './expenseService';
import { getUserById } from './userService';

// Lấy tất cả dự án completed trong tháng/năm
export const getCompletedProjectsInMonth = async (year, month) => {
  try {
    const startDate = new Date(year, month - 1, 1); // Tháng bắt đầu từ 0
    const endDate = new Date(year, month, 0); // Ngày cuối của tháng

    console.log('🔍 Tìm dự án hoàn thành:', {
      year,
      month,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Thử query đơn giản trước
    const simpleQuery = query(
      collection(db, 'projects'),
      where('status', '==', 'completed')
    );

    const simpleSnapshot = await getDocs(simpleQuery);
    console.log('📊 Tổng số dự án completed:', simpleSnapshot.size);

    const allCompletedProjects = [];
    simpleSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      allCompletedProjects.push(data);
      console.log('📋 Dự án completed:', {
        id: doc.id,
        name: data.name,
        status: data.status,
        completedAt: data.completedAt,
        updatedAt: data.updatedAt,
      });
    });

    // Lọc theo tháng
    const filteredProjects = allCompletedProjects.filter((project) => {
      const projectDate =
        project.completedAt?.toDate?.() ||
        project.completedAt ||
        project.updatedAt?.toDate?.() ||
        project.updatedAt;
      if (!projectDate) {
        console.log('⚠️ Dự án không có completedAt:', project.name);
        return false;
      }

      const projectYear = projectDate.getFullYear();
      const projectMonth = projectDate.getMonth() + 1;

      const isInRange = projectYear === year && projectMonth === month;
      console.log('📅 Kiểm tra dự án:', {
        name: project.name,
        projectDate: projectDate.toISOString(),
        projectYear,
        projectMonth,
        targetYear: year,
        targetMonth: month,
        isInRange,
      });

      return isInRange;
    });

    console.log('✅ Dự án trong tháng:', filteredProjects.length);
    return filteredProjects;
  } catch (error) {
    console.error('❌ Lỗi khi lấy dự án hoàn thành:', error);
    throw error;
  }
};

// Tính chi phí vật liệu cho một dự án
export const calculateProjectMaterialCost = async (projectId) => {
  try {
    // Lấy báo giá mới nhất của dự án
    const quotationsQuery = query(
      collection(db, 'quotations'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );
    const quotationsSnapshot = await getDocs(quotationsQuery);

    if (quotationsSnapshot.empty) return 0;

    const latestQuotation = quotationsSnapshot.docs[0].data();
    const materials = latestQuotation.materials || [];

    let totalMaterialCost = 0;
    const materialPrices = await getMaterialPriceByName();

    for (const material of materials) {
      const materialName = material.material?.toLowerCase() || '';
      const weight = Number(material.weight || 0);

      // Tìm giá vật liệu
      let pricePerKg = 0;
      if (materialName.includes('sus304')) {
        pricePerKg = materialPrices.sus304 || 55000;
      } else if (materialName.includes('ss400')) {
        pricePerKg = materialPrices.ss400 || 17000;
      } else {
        // Tìm trong danh sách vật liệu đã cấu hình
        const foundMaterial = Object.entries(materialPrices).find(
          ([name, price]) => materialName.includes(name.toLowerCase())
        );
        if (foundMaterial) {
          pricePerKg = foundMaterial[1];
        }
      }

      totalMaterialCost += weight * pricePerKg;
    }

    return totalMaterialCost;
  } catch (error) {
    console.error('Lỗi khi tính chi phí vật liệu:', error);
    return 0;
  }
};

// Tính chi phí nhân công cho một dự án
export const calculateProjectLaborCost = async (projectId) => {
  try {
    const sessionsQuery = query(
      collection(db, 'work_sessions'),
      where('projectId', '==', projectId)
    );
    const sessionsSnapshot = await getDocs(sessionsQuery);

    const sessions = [];
    sessionsSnapshot.forEach((doc) => {
      sessions.push({ id: doc.id, ...doc.data() });
    });

    const byWorker = new Map();
    for (const session of sessions.filter((s) => !!s.endTime)) {
      const workerId = session.workerId;
      if (!workerId) continue;

      const durationHours = Number(session.durationInHours || 0);
      const minutes = Math.round(durationHours * 60);

      const current = byWorker.get(workerId) || {
        workerId,
        workerName: session.workerName || 'Không tên',
        minutes: 0,
      };
      current.minutes += minutes;
      byWorker.set(workerId, current);
    }

    let totalLaborCost = 0;
    for (const [workerId, info] of byWorker.entries()) {
      // Lấy thông tin lương của worker
      const userQuery = query(
        collection(db, 'users'),
        where('uid', '==', workerId)
      );
      const userSnapshot = await getDocs(userQuery);

      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        const dailySalary = Number(userData?.dailySalary || 0);
        const monthlySalary = Number(userData?.monthlySalary || 0);

        let hourlyRate = 0;
        if (dailySalary > 0) {
          hourlyRate = dailySalary / 8;
        } else if (monthlySalary > 0) {
          hourlyRate = monthlySalary / 30 / 8;
        }

        const cost = (hourlyRate * info.minutes) / 60;
        totalLaborCost += cost;
      }
    }

    return totalLaborCost;
  } catch (error) {
    console.error('Lỗi khi tính chi phí nhân công:', error);
    return 0;
  }
};

// Tính chi phí phụ kiện cho một dự án
export const calculateProjectAccessoryCost = async (projectId) => {
  try {
    const projectQuery = query(
      collection(db, 'projects'),
      where('id', '==', projectId)
    );
    const projectSnapshot = await getDocs(projectQuery);

    if (!projectSnapshot.empty) {
      const projectData = projectSnapshot.docs[0].data();
      return Number(projectData?.accessoryPrice || 0);
    }
    return 0;
  } catch (error) {
    console.error('Lỗi khi tính chi phí phụ kiện:', error);
    return 0;
  }
};

// Tính tổng chi phí cho một dự án
export const calculateTotalProjectCost = async (projectId) => {
  try {
    const materialCost = await calculateProjectMaterialCost(projectId);
    const laborCost = await calculateProjectLaborCost(projectId);
    const accessoryCost = await calculateProjectAccessoryCost(projectId);

    return {
      materialCost,
      laborCost,
      accessoryCost,
      totalCost: materialCost + laborCost + accessoryCost,
    };
  } catch (error) {
    console.error('Lỗi khi tính tổng chi phí dự án:', error);
    return {
      materialCost: 0,
      laborCost: 0,
      accessoryCost: 0,
      totalCost: 0,
    };
  }
};

// Tạo báo cáo chi phí hàng tháng
export const generateMonthlyCostReport = async (year, month) => {
  try {
    console.log('🚀 Bắt đầu tạo báo cáo cho:', { year, month });

    // Lấy chi phí từ collection expenses trong tháng
    // Xóa dữ liệu test nếu tồn tại
    try {
      const removed = await deleteExpensesByProjectId('test-project-id');
      if (removed > 0) {
        console.log('🧹 Đã dọn dữ liệu test:', removed);
      }
    } catch (_) {}

    const expenses = (await getExpensesInMonth(year, month)).filter(
      (e) => e.projectId !== 'test-project-id'
    );
    console.log('📊 Chi phí trong tháng:', expenses.length);

    // Tính tổng chi phí dự án
    let totalProjectCost = 0;
    const projectCosts = [];

    // Gộp theo projectId để tránh trùng khóa (nếu có nhiều bản ghi trong tháng)
    const projectIdToExpense = new Map();
    for (const expense of expenses) {
      const existing = projectIdToExpense.get(expense.projectId);
      if (existing) {
        // Nếu trùng, giữ bản ghi tổng lớn nhất
        const merged = {
          ...existing,
          materialCost: Math.max(
            existing.materialCost || 0,
            expense.materialCost || 0
          ),
          laborCost: Math.max(existing.laborCost || 0, expense.laborCost || 0),
          accessoryCost: Math.max(
            existing.accessoryCost || 0,
            expense.accessoryCost || 0
          ),
          totalCost: Math.max(existing.totalCost || 0, expense.totalCost || 0),
        };
        projectIdToExpense.set(expense.projectId, merged);
        continue;
      }
      projectIdToExpense.set(expense.projectId, expense);
    }

    for (const expense of projectIdToExpense.values()) {
      const material = expense.materialCost || 0;
      const accessory = expense.accessoryCost || 0;
      const reportedTotal = material + accessory; // Loại NHÂN CÔNG khỏi báo cáo tháng

      console.log('💰 Chi phí dự án (report):', {
        projectName: expense.projectName,
        material,
        accessory,
        reportedTotal,
      });

      projectCosts.push({
        project: {
          id: expense.projectId,
          name: expense.projectName,
        },
        costBreakdown: {
          materialCost: material,
          accessoryCost: accessory,
          totalCost: reportedTotal,
        },
      });

      totalProjectCost += reportedTotal;
    }

    // Lấy chi phí cố định hàng tháng
    const fixedCosts = await getTotalMonthlyFixedCosts();
    console.log('🏢 Chi phí cố định:', fixedCosts);

    // Tính tổng lương nhân viên trong tháng
    const salaryQuery = query(
      collection(db, 'users'),
      where('role', 'in', [
        'cong_nhan',
        'ky_su',
        'ke_toan',
        'thuong_mai',
        'pho_giam_doc',
        'giam_doc',
      ])
    );
    const salarySnapshot = await getDocs(salaryQuery);
    let totalSalary = 0;
    console.log('👥 Danh sách nhân viên tính lương:');
    for (const doc of salarySnapshot.docs) {
      const user = doc.data();
      const dailySalary = Number(user.dailySalary || 0);
      const monthlySalary = Number(user.monthlySalary || 0);
      let userSalary = 0;

      if (dailySalary > 0) {
        // Tính theo ngày đi làm (cần thêm logic lấy số ngày đi làm)
        userSalary = dailySalary * 22; // Giả sử 22 ngày làm việc/tháng
        console.log(
          `  - ${
            user.name || user.displayName
          }: ${dailySalary.toLocaleString()}đ/ngày × 22 = ${userSalary.toLocaleString()}đ`
        );
      } else if (monthlySalary > 0) {
        userSalary = monthlySalary;
        console.log(
          `  - ${
            user.name || user.displayName
          }: ${monthlySalary.toLocaleString()}đ/tháng`
        );
      }

      totalSalary += userSalary;
    }
    console.log('💰 Tổng lương nhân viên:', totalSalary.toLocaleString());

    // Tổng chi phí
    const totalMonthlyCost = totalProjectCost + fixedCosts + totalSalary;
    console.log('💯 Tổng chi phí:', {
      totalProjectCost,
      fixedCosts,
      totalSalary,
      totalMonthlyCost,
    });

    const result = {
      year,
      month,
      completedProjects: projectCosts,
      totalProjectCost,
      fixedCosts,
      totalSalary,
      totalMonthlyCost,
      projectCount: projectCosts.length,
    };

    console.log('✅ Kết quả báo cáo:', result);
    return result;
  } catch (error) {
    console.error('❌ Lỗi khi tạo báo cáo chi phí hàng tháng:', error);
    throw error;
  }
};
