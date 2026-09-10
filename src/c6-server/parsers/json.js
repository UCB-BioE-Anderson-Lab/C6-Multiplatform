// src/c6-server/parsers/json.js
// Parses JSON resource files.

/**
 * @param {string} text
 * @param {string} fileName
 * @returns {{ type: string, description: string, keywords: string[], data: object }}
 */
export function parseJson(text, fileName = '') {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON parse error in ${fileName}: ${e.message}`);
  }

  const isSchema = data.$schema || data.type === 'object' || data.properties;
  const type = isSchema ? 'model' : 'json';

  const description = data.description ||
    data.name ||
    (isSchema ? `JSONSchema model${data.title ? ': ' + data.title : ''}` : fileName.replace(/\.[^/.]+$/, ''));

  const keywords = [
    fileName.replace(/\.[^/.]+$/, ''),
    data.name,
    ...(data.keywords || []),
    ...(isSchema && data.properties ? Object.keys(data.properties) : []),
  ].filter(k => k && typeof k === 'string');

  return {
    type,
    description,
    keywords: [...new Set(keywords)],
    data,
  };
}
