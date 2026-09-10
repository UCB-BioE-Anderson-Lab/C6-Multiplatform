/**
 * DriveAdapter.gs
 *
 * Implements the FsAdapter interface (from src/c6-server/fs-adapter.js) using
 * Google DriveApp. Called by Code.gs before dispatching to C6Server.
 *
 * The data folder is identified by C6_FOLDER_ID stored in Script Properties.
 * Set it once via the Apps Script UI or:
 *   PropertiesService.getScriptProperties().setProperty('C6_FOLDER_ID', '<id>');
 */

// ---------------------------------------------------------------------------
// Folder resolution
// ---------------------------------------------------------------------------

function getDataFolder() {
  var folderId = PropertiesService.getScriptProperties().getProperty('C6_FOLDER_ID');
  if (!folderId) throw new Error('C6_FOLDER_ID not set in Script Properties');
  return DriveApp.getFolderById(folderId);
}

/**
 * Resolve a relative path like "sequences/pBR322.gb" starting from rootFolder.
 * Returns { folder, name } or throws if an intermediate folder is missing.
 */
function resolvePath(rootFolder, relativePath) {
  var parts = relativePath.split('/');
  var name = parts.pop();
  var folder = rootFolder;
  for (var i = 0; i < parts.length; i++) {
    var iter = folder.getFoldersByName(parts[i]);
    if (!iter.hasNext()) throw new Error('Folder not found: ' + parts[i]);
    folder = iter.next();
  }
  return { folder: folder, name: name };
}

function ensurePath(rootFolder, relativePath) {
  var parts = relativePath.split('/');
  var name = parts.pop();
  var folder = rootFolder;
  for (var i = 0; i < parts.length; i++) {
    var iter = folder.getFoldersByName(parts[i]);
    folder = iter.hasNext() ? iter.next() : folder.createFolder(parts[i]);
  }
  return { folder: folder, name: name };
}

// ---------------------------------------------------------------------------
// FsAdapter implementation
// ---------------------------------------------------------------------------

var driveAdapter = {
  readFile: function(filePath) {
    var root = getDataFolder();
    var resolved = resolvePath(root, filePath);
    var iter = resolved.folder.getFilesByName(resolved.name);
    if (!iter.hasNext()) throw new Error('File not found: ' + filePath);
    return iter.next().getBlob().getDataAsString();
  },

  writeFile: function(filePath, content) {
    var root = getDataFolder();
    var resolved = ensurePath(root, filePath);
    var iter = resolved.folder.getFilesByName(resolved.name);
    if (iter.hasNext()) {
      iter.next().setContent(content);
    } else {
      resolved.folder.createFile(resolved.name, content, MimeType.PLAIN_TEXT);
    }
  },

  deleteFile: function(filePath) {
    var root = getDataFolder();
    var resolved = resolvePath(root, filePath);
    var iter = resolved.folder.getFilesByName(resolved.name);
    if (iter.hasNext()) iter.next().setTrashed(true);
  },

  listFiles: function() {
    var root = getDataFolder();
    var results = [];
    collectDriveFiles(root, '', results);
    return results;
  },

  exists: function(filePath) {
    try {
      var root = getDataFolder();
      var resolved = resolvePath(root, filePath);
      return resolved.folder.getFilesByName(resolved.name).hasNext();
    } catch (e) {
      return false;
    }
  },
};

function collectDriveFiles(folder, prefix, results) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    results.push(prefix + f.getName());
  }
  var folders = folder.getFolders();
  while (folders.hasNext()) {
    var sub = folders.next();
    collectDriveFiles(sub, prefix + sub.getName() + '/', results);
  }
}

// ---------------------------------------------------------------------------
// Index persistence via Script Properties (for fast access)
// ---------------------------------------------------------------------------

var INDEX_PROP_KEY = 'C6_INDEX';

function getIndex() {
  var raw = PropertiesService.getScriptProperties().getProperty(INDEX_PROP_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e) { return []; }
}

function saveIndexToProp(index) {
  // Script Properties has a 9KB per-property limit.
  // Fall back to writing to Drive if index is large.
  var serialized = JSON.stringify(index);
  if (serialized.length < 8000) {
    PropertiesService.getScriptProperties().setProperty(INDEX_PROP_KEY, serialized);
  } else {
    driveAdapter.writeFile('.c6index.json', serialized);
    PropertiesService.getScriptProperties().setProperty(INDEX_PROP_KEY, '__FILE__');
  }
}
