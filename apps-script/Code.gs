/**
 * Code.gs — C6 Web App entry point
 *
 * Deploy as a Web App:
 *   Execute as: Me (USER_DEPLOYING)
 *   Access: Anyone (or Anyone with Google account, your preference)
 *
 * After one-time deployment, all updates go through `clasp push` only.
 * The deployment URL never changes.
 *
 * Setup:
 *   1. Run initC6() once from the Apps Script editor to set C6_FOLDER_ID.
 *      You will be prompted to authorize Drive access.
 *   2. Deploy as Web App, note the /exec URL.
 *   3. Paste that URL into your sheet relay as C6_URL.
 */

// How stale the index can be before a rescan is triggered (ms)
var SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    wakeup();
    var req = JSON.parse(e.postData.contents);
    var index = getIndex();
    var result = C6Server.dispatch(req, driveAdapter, index);

    // If the action mutated the index, persist it
    if (result.index) saveIndexToProp(result.index);

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet(e) {
  // Lightweight health check / function listing
  try {
    var action = (e.parameter && e.parameter.action) || 'list_functions';
    var result = C6Server.dispatch({ action: action }, driveAdapter, getIndex());
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Wakeup / index sync
// ---------------------------------------------------------------------------

function wakeup() {
  var props = PropertiesService.getScriptProperties();
  var last = parseInt(props.getProperty('C6_LAST_SCAN') || '0', 10);
  if (Date.now() - last < SCAN_INTERVAL_MS) return;

  var index = getIndex();
  // C6Server.scanFolder is exposed by the IIFE bundle
  var updated = C6Server.scanFolder(driveAdapter, index);
  saveIndexToProp(updated);
  props.setProperty('C6_LAST_SCAN', String(Date.now()));
}

// ---------------------------------------------------------------------------
// One-time setup helper — run from the editor, not via HTTP
// ---------------------------------------------------------------------------

function initC6() {
  var ui = SpreadsheetApp.getUi ? SpreadsheetApp.getUi() : null;

  var folderId = ui
    ? ui.prompt('C6 Setup', 'Enter your C6-Data Drive folder ID:', ui.ButtonSet.OK).getResponseText()
    : PropertiesService.getScriptProperties().getProperty('C6_FOLDER_ID');

  if (!folderId) { Logger.log('No folder ID provided.'); return; }

  PropertiesService.getScriptProperties().setProperties({
    'C6_FOLDER_ID': folderId,
    'C6_LAST_SCAN': '0',
  });

  // Trigger an immediate scan
  wakeup();
  Logger.log('C6 initialized. Folder: ' + folderId);
}
