const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

const headerPath = path.resolve(__dirname, "0header.js");
const header = fs.existsSync(headerPath)
  ? fs.readFileSync(headerPath, "utf8")
  : "// Header not found";

const isProduction = process.env.NODE_ENV === "production";
const sourceMapFlag = (process.env.SOURCE_MAP || "").toString().toLowerCase();
const disableProdSourceMap =
  isProduction &&
  (sourceMapFlag === "0" ||
    sourceMapFlag === "false" ||
    sourceMapFlag === "no");
const enableInlineProdSourceMap = isProduction && sourceMapFlag === "inline";
const localDevHost = "http://127.0.0.1:5500";
const bundleFilename = "AlexQuant.user.js";
const localLoaderFilename = "AlexQuant.local-loader.user.js";

function buildLocalLoaderSource(headerContent, bundleFile) {
  const lines = headerContent.split(/\r?\n/);
  const transformed = [];
  let hasEndMarker = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\/\/\s*@name\b/.test(trimmed)) {
      transformed.push(
        line.replace(/^(\/\/\s*@name\s+)(.*)$/u, (_match, prefix, name) => {
          const cleanName = name.trim();
          return `${prefix}${cleanName} (Local Loader)`;
        }),
      );
      continue;
    }

    if (/^\/\/\s*@(updateURL|downloadURL)\b/.test(trimmed)) {
      continue;
    }

    if (trimmed === "// ==/UserScript==") {
      transformed.push(`// @connect      127.0.0.1`);
      transformed.push(line);
      hasEndMarker = true;
      continue;
    }

    transformed.push(line);
  }

  if (!hasEndMarker) {
    throw new Error(
      'Invalid userscript header: missing "// ==/UserScript==" end marker.',
    );
  }

  const devUrl = `${localDevHost}/.dist/${bundleFile}`;

  return `${transformed.join("\n")}

(async () => {
    'use strict';

    const DEV_URL = '${devUrl}';
    const requestUrl = DEV_URL + '?t=' + Date.now();

    function fetchText(url) {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: 'GET',
                url,
                headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) resolve(res.responseText);
                    else reject(new Error('HTTP ' + res.status + ' loading ' + url));
                },
                onerror: () => reject(new Error('Network error loading ' + url)),
                ontimeout: () => reject(new Error('Timeout loading ' + url)),
            });
        });
    }

    try {
        const code = await fetchText(requestUrl);
        const wrapped = code + '\\n//# sourceURL=' + requestUrl;
        const run = new Function('GM', 'unsafeWindow', wrapped);
        run(
            typeof GM !== 'undefined' ? GM : undefined,
            typeof unsafeWindow !== 'undefined' ? unsafeWindow : undefined,
        );
    } catch (err) {
        console.error('[AlexHedgeFund] Dev loader failed:', err);
    }
})();
`;
}

module.exports = {
  mode: isProduction ? "production" : "development",
  entry: "./src/AlexQuant.ts",
  target: "web",
  output: {
    path: path.resolve(__dirname, ".dist"),
    filename: bundleFilename,
    sourceMapFilename: "[file].map",
    clean: true,
  },
  devtool: isProduction
    ? disableProdSourceMap
      ? false
      : enableInlineProdSourceMap
        ? "inline-source-map"
        : "source-map"
    : "source-map",
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
    modules: [path.resolve(__dirname, "src"), "node_modules"],
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              [
                "@babel/preset-env",
                {
                  modules: false,
                  targets: [
                    "last 2 Chrome versions",
                    "last 2 Firefox versions",
                  ],
                  useBuiltIns: false,
                },
              ],
              [
                "@babel/preset-typescript",
                { allExtensions: true, isTSX: true },
              ],
            ],
          },
        },
      },
    ],
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: header,
      raw: true,
      entryOnly: true,
    }),
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(
        isProduction ? "production" : "development",
      ),
      BUILD_DATE: JSON.stringify(
        new Date()
          .toISOString()
          .slice(0, 16)
          .replace(/[-:]/g, "")
          .replace("T", "_"),
      ),
    }),
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap("AppendAbsoluteSourceMapURL", () => {
          const filePath = path.resolve(__dirname, ".dist", bundleFilename);
          const absoluteSourceMapURL = `//# sourceMappingURL=${localDevHost}/.dist/${bundleFilename}.map`;

          if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, "utf8");
            content = content.replace(
              /\/\/# sourceMappingURL=.*$/m,
              absoluteSourceMapURL,
            );
            fs.writeFileSync(filePath, content, "utf8");
          }

          const localLoaderPath = path.resolve(
            __dirname,
            ".dist",
            localLoaderFilename,
          );
          const localLoaderSource = buildLocalLoaderSource(
            header,
            bundleFilename,
          );
          fs.writeFileSync(localLoaderPath, localLoaderSource, "utf8");

          // Keep only one canonical userscript bundle in .dist.
          const staleDevBundlePath = path.resolve(
            __dirname,
            ".dist",
            "AlexQuant.debug.user.js",
          );
          const staleDevSourceMapPath = path.resolve(
            __dirname,
            ".dist",
            "AlexQuant.debug.user.js.map",
          );
          if (fs.existsSync(staleDevBundlePath)) {
            fs.rmSync(staleDevBundlePath);
          }
          if (fs.existsSync(staleDevSourceMapPath)) {
            fs.rmSync(staleDevSourceMapPath);
          }
        });
      },
    },
  ],
  optimization: {
    minimize: false,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: (_, comment) =>
              /==\/?UserScript==/.test(comment.value) ||
              /^\s*@/.test(comment.value),
          },
        },
      }),
    ],
    concatenateModules: isProduction,
    runtimeChunk: false,
    splitChunks: false,
  },
};
