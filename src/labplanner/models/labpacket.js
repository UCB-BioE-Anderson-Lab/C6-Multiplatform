/**
 * LabPacket is the complete output of the LabPlanner: an ordered set of
 * LabSheets corresponding to one planning run (one tab per operation type per run).
 */

/**
 * @typedef {Object} LabPacket
 * @property {string} id
 * @property {Object=} metadata
 * @property {Array<Object>} sheets   // array of LabSheet objects
 */

/**
 * Create an empty LabPacket.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {Object=} params.metadata
 * @returns {LabPacket}
 */
export function createLabPacket({ id, metadata }) {
  return {
    id,
    metadata: metadata || {},
    sheets: [],
  };
}

/**
 * Add a LabSheet to the packet.
 *
 * @param {LabPacket} packet
 * @param {Object} sheet
 */
export function addSheet(packet, sheet) {
  packet.sheets.push(sheet);
}

/**
 * Sort packet sheets by a deterministic operation order, then by title, then id.
 *
 * @param {LabPacket} packet
 * @param {Array<string>=} operationOrder
 */
export function sortSheets(packet, operationOrder) {
  const order = operationOrder || [
    'Dilution',
    'PCR',
    'Cleanup',
    'Gel',
    'Digest',
    'Ligate',
    'GoldenGate',
    'Gibson',
    'Transform',
    'Pick',
    'Miniprep',
  ];

  const rank = new Map(order.map((op, idx) => [op, idx]));

  packet.sheets.sort((a, b) => {
    const ra = rank.has(a.operation) ? rank.get(a.operation) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.operation) ? rank.get(b.operation) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;

    const ta = String(a.title || '');
    const tb = String(b.title || '');
    if (ta < tb) return -1;
    if (ta > tb) return 1;

    const ia = String(a.id || '');
    const ib = String(b.id || '');
    if (ia < ib) return -1;
    if (ia > ib) return 1;
    return 0;
  });
}
