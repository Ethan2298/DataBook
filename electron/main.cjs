const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    resizable: false,
    backgroundColor: '#0A0A0A',
    title: 'DataBook',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'dist', 'index.html'));
  }
});

app.on('window-all-closed', () => app.quit());
