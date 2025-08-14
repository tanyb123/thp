/**
 * Gets the Vietnamese display label for a task key.
 * @param {string} taskKey The key of the task (e.g., "material_cutting").
 * @param {any} taskData The data object for the task, used for the custom "other" task.
 * @returns {string} The display label for the task.
 */
export const getTaskDisplayLabel = (taskKey, taskData) => {
  const taskLabels = {
    material_separation: 'Bóc tách vật tư',
    quotation: 'Báo giá',
    material_purchasing: 'Mua vật tư',
    material_cutting: 'Cắt phôi',
    assembly: 'Lắp ráp',
    painting: 'Sơn',
    shipping: 'Vận chuyển',
    turning: 'Tiện',
    milling: 'Phay',
    welding: 'Hàn',
    bending: 'Chấn',
    drilling: 'Khoan',
    grinding: 'Mài',
    other: taskData?.name || 'Công việc khác',
  };
  return taskLabels[taskKey] || taskKey.replace(/_/g, ' ');
};

/**
 * Gets the Vietnamese display label for a task status.
 * @param {string} status The status key (e.g., "in_progress").
 * @returns {string} The display label for the status.
 */
export const getStatusDisplayLabel = (status) => {
  const statusLabels = {
    completed: 'Hoàn thành',
    in_progress: 'Đang thực hiện',
    pending: 'Chờ xử lý',
  };
  return statusLabels[status] || 'Không xác định';
};

/**
 * Gets the color code associated with a task status.
 * @param {string} status The status key (e.g., "in_progress").
 * @param {object} theme The application theme object.
 * @returns {string} The color hex code.
 */
export const getStatusColor = (status, theme = {}) => {
  switch (status) {
    case 'completed':
      return theme.statusCompleted || theme.success || '#28a745';
    case 'in_progress':
      return theme.statusInProgress || theme.info || '#17a2b8';
    case 'pending':
      return theme.statusPending || theme.warning || '#ffc107';
    default:
      return theme.textMuted || '#6c757d';
  }
};
