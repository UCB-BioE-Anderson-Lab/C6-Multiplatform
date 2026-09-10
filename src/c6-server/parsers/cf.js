// src/c6-server/parsers/cf.js
// Parses Construction File format (.cf) via existing parseCF().

import { parseCF } from '../../C6-Sim.js';

/**
 * @param {string} text
 * @param {string} fileName
 * @returns {{ type: string, description: string, keywords: string[], data: object }}
 */
export function parseCf(text, fileName = '') {
  const cf = parseCF(text);
  const name = fileName.replace(/\.[^/.]+$/, '') || 'construction file';
  const stepCount = cf.steps ? cf.steps.length : 0;
  const outputs = cf.steps ? cf.steps.map(s => s.output).filter(Boolean) : [];
  const description = `Construction file: ${stepCount} step${stepCount !== 1 ? 's' : ''}` +
    (outputs.length ? `, produces: ${outputs.slice(0, 3).join(', ')}${outputs.length > 3 ? '…' : ''}` : '');

  return {
    type: 'cf',
    description,
    keywords: [name, 'construction', ...outputs].filter(Boolean),
    data: cf,
  };
}
