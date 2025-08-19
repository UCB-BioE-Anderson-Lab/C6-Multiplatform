import json from '@rollup/plugin-json';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/IIFEc6-sim.min.js',
    format: 'iife',
    name: 'C6',
    exports: 'default',
    sourcemap: false,
  },
  plugins: [json()]
};