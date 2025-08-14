/**
 * Quản lý icon cho các loại công đoạn sản xuất
 * Sử dụng Ionicons - có thể xem danh sách đầy đủ tại: https://ionic.io/ionicons
 */

// Import build-time custom icons
import {
  BUILD_TIME_CUSTOM_ICONS,
  getBuildTimeIconByState,
} from './buildTimeIcons';

export const STAGE_ICONS = {
  // === CÔNG ĐOẠN CẮT ===
  laser_cutting: 'flash', // Cắt laser - tia chớp
  plasma_cutting: 'flash-outline', // Cắt plasma - tia chớp viền
  cutting: 'cut-outline', // Cắt thông thường - kéo cắt
  cat_phoi: 'cut', // Cắt phôi - kéo cắt đậm

  // === CÔNG ĐOẠN HÀN ===
  welding: 'flame', // Hàn - ngọn lửa
  arc_welding: 'flame-outline', // Hàn hồ quang - ngọn lửa viền
  han: 'bonfire', // Hàn - lửa trại
  han_diem: 'radio-button-on', // Hàn điểm - chấm tròn

  // === CÔNG ĐOẠN SƠN ===
  painting: 'color-palette', // Sơn - bảng màu
  spray_painting: 'brush-outline', // Sơn phun - cọ viền
  son: 'brush', // Sơn - cọ sơn
  son_lot: 'color-filter', // Sơn lót - bộ lọc màu

  // === CÔNG ĐOẠN GIA CÔNG ===
  machining: 'hammer', // Gia công - búa
  drilling: 'radio-button-on', // Khoan - chấm tròn
  milling: 'cog', // Phay - bánh răng
  turning: 'refresh', // Tiện - xoay
  grinding: 'disc', // Mài - đĩa

  // === CÔNG ĐOẠN LẮP RÁP ===
  assembly: 'build', // Lắp ráp - xây dựng
  lap_rap: 'construct', // Lắp ráp - xây dựng viền
  final_assembly: 'layers', // Lắp ráp cuối - nhiều lớp

  // === CÔNG ĐOẠN KIỂM TRA ===
  inspection: 'eye', // Kiểm tra - mắt
  quality_check: 'shield-checkmark', // Kiểm tra chất lượng - khiên tick
  testing: 'flask', // Thử nghiệm - bình thí nghiệm
  kiem_tra: 'search', // Kiểm tra - kính lúp

  // === CÔNG ĐOẠN VẬN CHUYỂN ===
  shipping: 'car', // Vận chuyển - xe hơi
  van_chuyen: 'airplane', // Vận chuyển - máy bay
  delivery: 'bicycle', // Giao hàng - xe đạp
  logistics: 'bus', // Logistics - xe buýt

  // === CÔNG ĐOẠN ĐÓNG GÓI ===
  packaging: 'cube', // Đóng gói - hình khối
  dong_goi: 'archive', // Đóng gói - lưu trữ
  wrapping: 'gift', // Bao bì - quà tặng

  // === CÔNG ĐOẠN KHÁC ===
  preparation: 'clipboard', // Chuẩn bị - bảng ghi
  setup: 'settings', // Thiết lập - cài đặt
  maintenance: 'construct-outline', // Bảo trì - sửa chữa viền
  cleaning: 'water', // Vệ sinh - nước

  // === MẶC ĐỊNH ===
  default: 'ellipse', // Mặc định - hình elip
};

// Cache cho custom icons
let customIconsCache = {};

/**
 * Load custom icons từ AsyncStorage
 */
export const loadCustomIcons = async () => {
  try {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    const saved = await AsyncStorage.getItem('customStageIcons');
    if (saved) {
      customIconsCache = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading custom icons:', error);
  }
};

/**
 * Lấy icon cho một loại công đoạn
 * @param {string} processKey - Khóa của công đoạn
 * @param {boolean} isCompleted - Trạng thái hoàn thành (optional)
 * @returns {string|Object} Tên icon Ionicons hoặc custom icon object
 */
export const getStageIcon = (processKey, isCompleted = false) => {
  // 1. Ưu tiên custom icon từ user upload (runtime)
  const customIcon = customIconsCache[processKey];
  if (customIcon) {
    return customIcon;
  }

  // 2. Kiểm tra build-time custom icons (với state-aware)
  const buildTimeIcon = getBuildTimeIconByState(processKey, isCompleted);
  if (buildTimeIcon) {
    return {
      type: 'asset',
      data: buildTimeIcon,
    };
  }

  // 3. Cuối cùng mới dùng Ionicons default
  return STAGE_ICONS[processKey] || STAGE_ICONS.default;
};

/**
 * Cập nhật custom icons cache
 * @param {Object} customIcons - Object chứa custom icons
 */
export const updateCustomIconsCache = (customIcons) => {
  customIconsCache = { ...customIcons };
};

/**
 * Danh sách các icon phổ biến có thể sử dụng
 * Tham khảo: https://ionic.io/ionicons
 */
export const AVAILABLE_ICONS = {
  // Công cụ
  tools: ['hammer', 'build', 'construct', 'settings', 'cog', 'wrench'],

  // Sản xuất
  manufacturing: ['flash', 'flame', 'brush', 'cut', 'layers', 'disc'],

  // Kiểm tra
  inspection: [
    'eye',
    'search',
    'checkmark-circle',
    'shield-checkmark',
    'flask',
  ],

  // Vận chuyển
  transport: ['car', 'airplane', 'bicycle', 'bus', 'boat', 'train'],

  // Đóng gói
  packaging: ['cube', 'archive', 'gift', 'bag', 'basket'],

  // Hình dạng cơ bản
  shapes: ['circle', 'square', 'triangle', 'ellipse', 'diamond'],

  // Mũi tên và chỉ thị
  arrows: ['arrow-forward', 'arrow-up', 'arrow-down', 'play', 'stop'],
};

/**
 * Tạo mapping tùy chỉnh cho dự án cụ thể
 * @param {Object} customMapping - Object mapping processKey -> iconName
 * @returns {Object} Merged icon mapping
 */
export const createCustomIconMapping = (customMapping = {}) => {
  return { ...STAGE_ICONS, ...customMapping };
};
