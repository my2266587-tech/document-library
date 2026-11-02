import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // tesseract.js spawns its worker script and loads its .wasm by file path,
  // so it must stay a plain Node package and its files must ship with the route.
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],
  outputFileTracingIncludes: {
    "/api/documents/content-index": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/*.{js,wasm,json}",
      "./node_modules/{bmp-js,idb-keyval,is-url,node-fetch,regenerator-runtime,wasm-feature-detect,zlibjs,whatwg-url,tr46,webidl-conversions}/**/*",
    ],
  },
};

export default nextConfig;
