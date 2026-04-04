const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const chokidar = require('chokidar');

const isDev = !app.isPackaged;

Menu.setApplicationMenu(null);

// ── DatabaseManager (loaded dynamically since it's ESM) ─────────────────────

const DATA_DIR = process.env.DATABOOK_DIR ?? path.join(os.homedir(), '.databook');
let manager = null;

async function getManager() {
  if (manager) return manager;
  const dbManagerPath = path.join(__dirname, '..', 'dist', 'database-manager.js');
  const { DatabaseManager } = await import(
    /* webpackIgnore: true */
    'file://' + dbManagerPath.replace(/\\/g, '/')
  );
  manager = new DatabaseManager(DATA_DIR);
  return manager;
}

// Wrap handler so errors return as rejected promises (shown in renderer)
function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    const mgr = await getManager();
    return fn(mgr, ...args);
  });
}

// ── Database management ─────────────────────────────────────────────────────
handle('db:listDatabases', (m) => m.listDatabases());
handle('db:createDatabase', (m, name) => m.createDatabase(name));
handle('db:deleteDatabase', (m, name) => m.deleteDatabase(name));
handle('db:selectDatabase', (m, name) => m.selectDatabase(name));

// ── Schema ──────────────────────────────────────────────────────────────────
handle('db:listTables', (m) => m.listTables());
handle('db:describeTable', (m, table) => m.describeTable(table));
handle('db:createTable', (m, table, columns) => m.createTable(table, columns));
handle('db:alterTable', (m, table, ops) => m.alterTable(table, ops));
handle('db:dropTable', (m, table) => m.dropTable(table));

// ── Data CRUD ───────────────────────────────────────────────────────────────
handle('db:insertRows', (m, table, rows) => m.insertRows(table, rows));
handle('db:updateRows', (m, table, set, where, params) => m.updateRows(table, set, where, params ?? []));
handle('db:deleteRows', (m, table, where, params) => m.deleteRows(table, where, params ?? []));

// ── Query ───────────────────────────────────────────────────────────────────
handle('db:query', (m, sql, params) => m.query(sql, params ?? []));

// ── Query Pages ─────────────────────────────────────────────────────────────
handle('db:createQueryPage', (m, name, query, viewType, viewConfig) => m.createQueryPage(name, query, viewType, viewConfig));
handle('db:listQueryPages', (m) => m.listQueryPages());
handle('db:updateQueryPage', (m, name, updates) => m.updateQueryPage(name, updates));
handle('db:deleteQueryPage', (m, name) => m.deleteQueryPage(name));

// ── Column Options (status tags) ────────────────────────────────────────────
handle('db:getColumnOptions', (m, table, column) => m.getColumnOptions(table, column));
handle('db:getAllColumnOptions', (m) => m.getAllColumnOptions());
handle('db:addColumnOption', (m, table, column, value, color) => m.addColumnOption(table, column, value, color));
handle('db:removeColumnOption', (m, table, column, value) => m.removeColumnOption(table, column, value));

// ── Column Order ────────────────────────────────────────────────────────────
handle('db:getColumnOrder', (m, table) => m.getColumnOrder(table));
handle('db:setColumnOrder', (m, table, columns) => m.setColumnOrder(table, columns));

// ── Column Metadata (Field Types) ──────────────────────────────────────────
handle('db:setColumnMetadata', (m, table, column, fieldType, config) => m.setColumnMetadata(table, column, fieldType, config));
handle('db:getColumnMetadata', (m, table, column) => m.getColumnMetadata(table, column));
handle('db:getAllColumnMetadata', (m, table) => m.getAllColumnMetadata(table));
handle('db:removeColumnMetadata', (m, table, column) => m.removeColumnMetadata(table, column));
handle('db:resolveRelation', (m, targetTable, ids, displayColumn) => m.resolveRelation(targetTable, ids, displayColumn));
handle('db:searchRelation', (m, targetTable, displayColumn, searchText) => m.searchRelation(targetTable, displayColumn, searchText));
handle('db:computeRollup', (m, table, rowId, config) => m.computeRollup(table, rowId, config));

// ── View Filter/Sort ───────────────────────────────────────────────────────
handle('db:getViewFilterSort', (m, itemName, itemKind, viewType) => m.getViewFilterSort(itemName, itemKind, viewType));
handle('db:setViewFilterSort', (m, itemName, itemKind, viewType, config) => m.setViewFilterSort(itemName, itemKind, viewType, config));

// ── Row History ────────────────────────────────────────────────────────────
handle('db:getTableHistory', (m, table, limit, offset) => m.getTableHistory(table, limit ?? 50, offset ?? 0));
handle('db:getRowHistory', (m, table, rowPk) => m.getRowHistory(table, rowPk));
handle('db:revertChange', (m, historyId) => m.revertChange(historyId));

// ── File watcher for external changes (e.g. MCP server) ─────────────────────

let mainWindow = null;
let fsWatcher = null;

function startWatching() {
  // Ensure directory exists before watching
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let debounceTimer = null;
  fsWatcher = chokidar.watch(DATA_DIR, {
    persistent: false,
    ignoreInitial: true,
    depth: 0,
  });

  fsWatcher.on('all', (_eventType, filePath) => {
    if (!filePath.endsWith('.db')) return;
    // Debounce: collapse rapid changes into a single refresh
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('db:external-change');
      }
    }, 200);
  });
}

// ── Window ──────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0A0A0A',
    title: 'DataBook',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'dist', 'index.html'));
  }

  startWatching();
});

app.on('window-all-closed', () => {
  if (fsWatcher) fsWatcher.close();
  app.quit();
});
