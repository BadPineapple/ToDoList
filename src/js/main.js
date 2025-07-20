const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getAllLists, addList } = require('../../db/db.js');

async function ensureInitialList() {
  try {
    console.log('[ensureInitialList] Verifying if lists exist...');
    const listas = await getAllLists();
    console.log('[ensureInitialList] Lists found:', listas.length);

    if (listas.length === 0) {
      console.log('[ensureInitialList] No lists found. Creating default...');
      const id = await addList({
        nome: 'Pessoal',
        descricao: 'Lista padrão criada automaticamente',
        oculto: false
      });
      console.log(`✅ Default list created (ID ${id})`);
    }
  } catch (err) {
    console.error('❌ Error in ensureInitialList:', err);
  }
}

function createWindow() {
  console.log('[createWindow] Creating application window...');
  const win = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    webPreferences: {
      nodeIntegration: true,       // ✅ permite require() no renderer
      contextIsolation: false      // ✅ desativa sandbox seguro (acesso total ao Node)
    }
  });

  win.loadFile('src/html/index.html');

  ipcMain.on('minimize-window', () => {
    console.log('[IPC] minimize-window received');
    win.minimize();
  });

  ipcMain.on('close-window', () => {
    console.log('[IPC] close-window received');
    win.close();
  });
}

app.whenReady().then(async () => {
  console.log('[app] Electron app is ready');
  await ensureInitialList();
  createWindow();

  app.on('activate', () => {
    console.log('[app] activate event');
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on("quit-app", () => {
  console.log('[IPC] quit-app received');
  app.quit();
});

ipcMain.on("minimize-app", () => {
  console.log('[IPC] minimize-app received');
  app.hide();
});

ipcMain.handle('getAllLists', async () => await getAllLists());
ipcMain.handle('addList', async (event, list) => await addList(list));
