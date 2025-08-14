const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add Node.js polyfills
config.resolver.alias = {
  ...config.resolver.alias,
  stream: 'stream-browserify',
  crypto: 'crypto-browserify',
  buffer: '@craftzdog/react-native-buffer',
  util: 'util',
  assert: 'assert',
  fs: false,
  path: 'path-browserify',
  os: 'os-browserify',
  url: 'url',
  querystring: 'querystring-es3',
  http: false,
  https: false,
  zlib: false,
  tty: false,
  net: false,
  child_process: false,
};

// Add resolver platforms
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;
