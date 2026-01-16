const webpack = require('webpack');
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/app.js',

  output: {
    filename: '[name].min.js',
    path: path.resolve(__dirname, 'dist'),
  },

  externals: [
    'XWiki', // XWiki JS library
    'Class', // PrototypeJS
    'Prototype',
    '$$',
    '$',
    '$F',
    'jQuery',  // jQuery library
    'Raphael', // Raphael library
  ],

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env']
        }
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ]
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [{
         loader: 'file-loader',
         options: {
           outputPath: 'assets',
           publicPath: 'dist/assets',
         }
       }]
      }
    ]
  },

  devServer: {
    static: './',
    port: 9000
  },

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          ecma: 8,
          mangle: {
            reserved: ['$super'],
          },
        },
      }),
    ],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        publicVendor: {
          test: /[\\/]public[\\/]vendor[\\/]/,
          name: 'public-vendors',
          chunks: 'all',
          priority: 5,
        },
      },
    },
  },

  performance: {
    hints: 'warning',
    maxAssetSize: 500 * 1024,
    maxEntrypointSize: 500 * 1024,
  },

  resolve: {
  	alias: {
      'pedigree': path.resolve(__dirname, 'src/script/'),
      'vendor': path.resolve(__dirname, 'public/vendor/'),
  	}
  }
};
