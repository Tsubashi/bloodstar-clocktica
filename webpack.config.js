const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const path = require('path');
const config = {
    entry: {main:"./src/main.ts",mobile:"./src/mobile.ts"},
    module: {
        rules:[{
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/
        }, {
            test: /\.css$/,
            use: [
                MiniCssExtractPlugin.loader,
                {
                    loader: 'css-loader',
                    options: {url:false}
                }
            ],
            exclude: /node_modules/
        }, {
            test: /\.(png|woff|woff2|eot|ttf|svg)$/i,
            use: [{
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]',
                    outputPath: 'fonts/'
                }
            }],
            exclude: /node_modules/
        }]
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Bloodstar Clocktica',
            template: './src/index.html',
            chunks: ['main'],
        }),
        new HtmlWebpackPlugin({
            title: 'Bloodstar Clocktica',
            template: './src/m.html',
            chunks: ['mobile'],
            filename: 'm.html'
        }),
         
        new MiniCssExtractPlugin({filename:'bloodstar.[contenthash].css',chunkFilename:'[id].css'}),
    ],
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    output: {
        filename: '[name].[contenthash].js',
        path: path.resolve(__dirname, 'dist')
    },
    optimization:{
        runtimeChunk: 'single',
        minimizer: [
            '...',
            new CssMinimizerPlugin(),
        ],
        splitChunks: {
            chunks: 'all',
        }
    }
};

module.exports = (env, argv) => {
    if (argv.mode === 'development') {
        config.devtool = 'eval-source-map';
        config.output.filename = '[name].js';
        config.plugins = config.plugins.map(plugin=>{
            if (!(plugin instanceof MiniCssExtractPlugin)) {return plugin;}
            return new MiniCssExtractPlugin({filename:'[name].css',chunkFilename:'[id].css'});
        });
    }

    return config;
};
