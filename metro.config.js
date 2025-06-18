const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Thêm hỗ trợ cho các file .cjs
defaultConfig.resolver.sourceExts.push('cjs');

// Vô hiệu hóa package exports để khắc phục lỗi "Component auth has not been registered yet"
defaultConfig.resolver.unstable_enablePackageExports = false;

module.exports = defaultConfig; 