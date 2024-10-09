const webpack = require('webpack');
const path = require('path');
const { GoogleClosureLibraryWebpackPlugin } = require('google-closure-library-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
  entry: './src/app.js',

  plugins: [
    new Dotenv(),
    new GoogleClosureLibraryWebpackPlugin({
      base: './node_modules/google-closure-library/closure/goog/base.js',
      sources: [
        path.resolve(__dirname, 'src/**/*.js')
      ],
      debug: {
        logTransformed: true
      }
    }),
  ],

  output: {
    filename: 'pedigree.min.js',
    path: path.resolve(__dirname, 'dist'),
  },

  externals: [
    'XWiki', // XWiki JS library
    'Class', // PrototypeJS
    'Prototype',
    '$$',
    '$',
    '$F',
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
    contentBase: path.join(__dirname, '.'),
    port: 9000
  },

  resolve: {
  	alias: {
      'pedigree': path.resolve(__dirname, 'src/script/'),
      'vendor': path.resolve(__dirname, 'public/vendor/'),
  	}
  }
};
