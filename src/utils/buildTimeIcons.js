/**
 * Build-time custom icons
 * Những icon này sẽ được build sẵn vào app và có sẵn cho tất cả users
 */

// Import các custom icons từ assets
const laser1Icon = require('../assets/custom-icons/laser1.png'); // Chưa thực hiện và in progress
const laser2Icon = require('../assets/custom-icons/laser2.png'); // Completed
const bending1Icon = require('../assets/custom-icons/bending1.png'); // Chấn - chưa thực hiện và in progress
const bending2Icon = require('../assets/custom-icons/bending2.png'); // Chấn - completed
const welding1Icon = require('../assets/custom-icons/welding1.png'); // Hàn - chưa thực hiện và in progress
const welding2Icon = require('../assets/custom-icons/welding2.png'); // Hàn - completed
const grinder1Icon = require('../assets/custom-icons/grinder1.png'); // Mài - chưa thực hiện và in progress
const grinder2Icon = require('../assets/custom-icons/grinder2.png'); // Mài - completed
const ndt1Icon = require('../assets/custom-icons/ndt1.png'); // NDT - chưa thực hiện và in progress
const ndt2Icon = require('../assets/custom-icons/ndt2.png'); // NDT - completed
const order1Icon = require('../assets/custom-icons/order1.png'); // Order - chưa thực hiện và in progress
const order2Icon = require('../assets/custom-icons/order2.png'); // Order - completed
const polisher1Icon = require('../assets/custom-icons/polisher1.png'); // Polisher - chưa thực hiện và in progress
const polisher2Icon = require('../assets/custom-icons/polisher2.png'); // Polisher - completed
const pressing1Icon = require('../assets/custom-icons/pressing1.png'); // Pressing - chưa thực hiện và in progress
const pressing2Icon = require('../assets/custom-icons/pressing2.png'); // Pressing - completed
const rolling1Icon = require('../assets/custom-icons/rolling1.png'); // Rolling - chưa thực hiện và in progress
const rolling2Icon = require('../assets/custom-icons/rolling2.png'); // Rolling - completed
const paintBucketEmpty = require('../assets/custom-icons/paint-bucket_4228960.png');
const paintBucketFull = require('../assets/custom-icons/paint-bucket_4229235.png');

export const BUILD_TIME_CUSTOM_ICONS = {
  // Laser cutting icon - default cho chưa thực hiện và in progress
  laser_cutting: laser1Icon,

  // Bending (Chấn) - default cho chưa thực hiện và in progress
  bending: bending1Icon,

  // Welding (Hàn) - default cho chưa thực hiện và in progress
  welding: welding1Icon,

  // Grinding (Mài) - default cho chưa thực hiện và in progress
  grinding: grinder1Icon,

  // NDT - default cho chưa thực hiện và in progress
  ndt: ndt1Icon,

  // Order - default cho chưa thực hiện và in progress
  order: order1Icon,

  // Polisher - default cho chưa thực hiện và in progress
  polisher: polisher1Icon,

  // Pressing - default cho chưa thực hiện và in progress
  pressing: pressing1Icon,

  // Rolling - default cho chưa thực hiện và in progress
  rolling: rolling1Icon,

  // Paint icons - sẽ được xử lý đặc biệt dựa trên state
  painting: paintBucketEmpty, // Default cho painting
  son: paintBucketEmpty, // Default cho sơn

  // TODO: Thêm icons cho các process keys khác khi có file icon tương ứng:
  // material_separation: 'Bóc tách vật tư',
  // quotation: 'Báo giá',
  // material_purchasing: 'Mua vật tư',
  // material_cutting: 'Cắt phôi',
  // assembly: 'Lắp ráp',
  // shipping: 'Vận chuyển',
  // turning: 'Tiện',
  // milling: 'Phay',
  // drilling: 'Khoan',
};

// Icons cho trạng thái hoàn thành
export const COMPLETED_STATE_ICONS = {
  laser_cutting: laser2Icon, // Laser completed
  bending: bending2Icon, // Chấn completed
  welding: welding2Icon, // Hàn completed
  grinding: grinder2Icon, // Mài completed
  ndt: ndt2Icon, // NDT completed
  order: order2Icon, // Order completed
  polisher: polisher2Icon, // Polisher completed
  pressing: pressing2Icon, // Pressing completed
  rolling: rolling2Icon, // Rolling completed
  painting: paintBucketFull,
  son: paintBucketFull,
};

/**
 * Kiểm tra xem processKey có build-time custom icon không
 * @param {string} processKey
 * @returns {boolean}
 */
export const hasBuildTimeIcon = (processKey) => {
  return BUILD_TIME_CUSTOM_ICONS[processKey] !== undefined;
};

/**
 * Lấy build-time custom icon
 * @param {string} processKey
 * @returns {any} React Native Image source
 */
export const getBuildTimeIcon = (processKey) => {
  return BUILD_TIME_CUSTOM_ICONS[processKey];
};

/**
 * Lấy build-time custom icon dựa trên trạng thái
 * @param {string} processKey - Khóa của công đoạn
 * @param {boolean} isCompleted - Trạng thái hoàn thành
 * @returns {any} React Native Image source
 */
export const getBuildTimeIconByState = (processKey, isCompleted = false) => {
  // Nếu hoàn thành và có icon đặc biệt cho trạng thái hoàn thành
  if (isCompleted && COMPLETED_STATE_ICONS[processKey]) {
    return COMPLETED_STATE_ICONS[processKey];
  }

  // Trả về icon mặc định
  return BUILD_TIME_CUSTOM_ICONS[processKey];
};
