/* eslint-env node */

import { Configuration as WebpackConfiguration } from "webpack";
import * as path from "path";

var PACKAGE = require('./package.json');
var version = PACKAGE.version;
const extName = PACKAGE.name;

const config: WebpackConfiguration = {
    mode: "development",
    entry: {
        extension: './src/index.tsx',
    },
    output: {
        filename: `extensions-${extName}.js`,
        path: __dirname + `/dist/assistant/extensions-${extName}`,
        libraryTarget: 'window',
        library: ['extensions', 'resources'],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json', '.ttf', '.scss']
    },
    externals: {
        react: 'React',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                options: {
                    allowTsInNodeModules: true,
                    configFile: path.resolve('./tsconfig.json')
                },
            },
            {
                test: /\.scss$/,
                use: ['style-loader', 'raw-loader', 'sass-loader'],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
};

if (process.env.NODE_ENV === "production") {
    config.mode = "production";
    if (config.output) {
        config.output.filename = `extension-${extName}-bundle-${version}.min.js`;
        config.output.chunkFilename = '[name]-chunk-[chunkhash].min.js';
    }
    if (config.optimization) {
        config.optimization.chunkIds = 'deterministic';
        config.optimization.minimize = true;
    }
    config.devtool = false;
}

export default config;
