const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    main: './main.js',
    preload: './preload.js',
    'oauth-server': './oauth-server.js',
    'secure-config': './secure-config.js',
    'generate-secure-config': './generate-secure-config.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  target: 'node',
  mode: 'production',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true
          },
          mangle: {
            toplevel: true
          },
          output: {
            comments: false
          }
        },
        extractComments: false
      })
    ]
  },
  module: {
    rules: []
  },
  resolve: {
    extensions: ['.js']
  },
  externals: {
    'electron': 'commonjs electron',
    'googleapis': 'commonjs googleapis',
    'otplib': 'commonjs otplib',
    'electron-store': 'commonjs electron-store'
  }
}; 