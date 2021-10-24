import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import html from "@rollup/plugin-html";
import replace from "@rollup/plugin-replace";

const sourcemap = true;
export default {
  input: {
    index: "examples/index.tsx",
  },
  output: {
    sourcemap,
    format: "esm",
    dir: `build/examples/`,
    entryFileNames: `[name]-[hash].js`,
    chunkFileNames: `[name]-[hash].js`,
    assetFileNames: `[name]-[hash][extname]`,
  },
  plugins: [
    resolve({
      browser: true,
      extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
      dedupe: ["slate", "solid-js", "immer"],
    }),
    replace({
      preventAssignment: true,
      values: {
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      },
    }),
    babel({
      extensions: [".js", ".jsx", ".ts", ".tsx"],
      exclude: "node_modules/**",
      babelrc: false,
      babelHelpers: "bundled",
      presets: [
        ["solid", { generate: "dom", hydratable: false }],
        "@babel/preset-typescript",
      ],
    }),
    commonjs(),
    html({
      fileName: "index.html",
    }),
  ],
  watch: {
    clearScreen: false,
  },
};
