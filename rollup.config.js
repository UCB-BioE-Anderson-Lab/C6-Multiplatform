import json from '@rollup/plugin-json';

export default [
  {
    input: 'src/index.js',
    output: {
      file: 'dist/c6-sim.min.js',
      format: 'umd',
      name: 'C6',
      exports: 'default',
      sourcemap: true,
    },
    plugins: [json()],
  },
  {
    // IIFE bundle for Apps Script — output goes directly into apps-script/
    // so `clasp push` picks it up automatically after `npm run build`.
    input: 'src/c6-server/index.js',
    output: {
      file: 'apps-script/c6-server.min.js',
      format: 'iife',
      name: 'C6Server',
      exports: 'named',
      sourcemap: false,
    },
    plugins: [json()],
  },
];