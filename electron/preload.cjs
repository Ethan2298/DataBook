const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('databook', {
  // External change listener (fires when MCP or another process modifies a .db file)
  onExternalChange: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('db:external-change', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('db:external-change', listener);
  },

  // Database management
  listDatabases: () => ipcRenderer.invoke('db:listDatabases'),
  createDatabase: (name) => ipcRenderer.invoke('db:createDatabase', name),
  deleteDatabase: (name) => ipcRenderer.invoke('db:deleteDatabase', name),
  selectDatabase: (name) => ipcRenderer.invoke('db:selectDatabase', name),

  // Schema
  listTables: () => ipcRenderer.invoke('db:listTables'),
  describeTable: (table) => ipcRenderer.invoke('db:describeTable', table),
  createTable: (table, columns) => ipcRenderer.invoke('db:createTable', table, columns),
  alterTable: (table, operations) => ipcRenderer.invoke('db:alterTable', table, operations),
  dropTable: (table) => ipcRenderer.invoke('db:dropTable', table),

  // Data CRUD
  insertRows: (table, rows) => ipcRenderer.invoke('db:insertRows', table, rows),
  updateRows: (table, set, where, params) => ipcRenderer.invoke('db:updateRows', table, set, where, params),
  deleteRows: (table, where, params) => ipcRenderer.invoke('db:deleteRows', table, where, params),

  // Query
  query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),

  // Query Pages
  createQueryPage: (name, query, viewType, viewConfig) => ipcRenderer.invoke('db:createQueryPage', name, query, viewType, viewConfig),
  listQueryPages: () => ipcRenderer.invoke('db:listQueryPages'),
  updateQueryPage: (name, updates) => ipcRenderer.invoke('db:updateQueryPage', name, updates),
  deleteQueryPage: (name) => ipcRenderer.invoke('db:deleteQueryPage', name),

  // Column Options (status tags)
  getColumnOptions: (table, column) => ipcRenderer.invoke('db:getColumnOptions', table, column),
  getAllColumnOptions: () => ipcRenderer.invoke('db:getAllColumnOptions'),
  addColumnOption: (table, column, value, color) => ipcRenderer.invoke('db:addColumnOption', table, column, value, color),
  removeColumnOption: (table, column, value) => ipcRenderer.invoke('db:removeColumnOption', table, column, value),

  // Column Order
  getColumnOrder: (table) => ipcRenderer.invoke('db:getColumnOrder', table),
  setColumnOrder: (table, columns) => ipcRenderer.invoke('db:setColumnOrder', table, columns),
});
