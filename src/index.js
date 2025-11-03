// src/index.js

import * as Annotator from './C6-Annotator.js';
import * as Gene from './C6-Gene.js';
import * as Oligos from './C6-Oligos.js';
import * as Seq from './C6-Seq.js';
import * as Sim from './C6-Sim.js';
import * as Utils from './C6-Utils.js';
import * as Inventory from './inventory/inventory.js';
import * as Manage from './inventory/manage.js';
import * as Query from './inventory/query.js';
import * as IO from './inventory/io.js';

const C6 = {
  ...Annotator,
  ...Gene,
  ...Oligos,
  ...Seq,
  ...Sim,
  ...Utils,
  ...Inventory,
  ...Manage,
  ...Query,
  ...IO,
};

// Expose module namespaces for UMD consumers
C6.Inventory = Inventory;
C6.Manage = Manage;
C6.Query = Query;
C6.io = IO;            // primary IO namespace
C6.InventoryIO = IO;   // alias for older references

C6.VERSION = '1.0.11';

export default C6;