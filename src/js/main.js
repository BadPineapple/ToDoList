const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const {
  getAllLists,
  addList,
  deleteList,
  deleteTask,
  getListById,
  updateList
} = require('../../db/db.js');

// Garante que ao iniciar, exista ao menos uma lista padrão
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

// Cria a janela principal
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
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('src/html/index.html');

  // IPC de controle de janela
  ipcMain.on('minimize-window', () => {
    console.log('[IPC] minimize-window received');
    win.minimize();
  });

  ipcMain.on('close-window', () => {
    console.log('[IPC] close-window received');
    win.close();
  });

  // Abrir modal de lista
  ipcMain.handle('openListModal', (_, idLista = null) => {
    console.log('[IPC] openListModal requested for ID:', idLista);
    const modal = new BrowserWindow({
      width: 300,
      height: 360,
      resizable: false,
      modal: true,
      parent: BrowserWindow.getFocusedWindow(),
      frame: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const modalURL = idLista
      ? `file://${path.join(__dirname, '../html/list.html')}?id=${idLista}`
      : `file://${path.join(__dirname, '../html/list.html')}`;

    modal.loadURL(modalURL);
  });
}

// Evento principal
app.whenReady().then(async () => {
  console.log('[app] Electron app is ready');
  await ensureInitialList();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// IPCs adicionais
ipcMain.on('quit-app', () => {
  console.log('[IPC] quit-app received');
  app.quit();
});

ipcMain.on('minimize-app', () => {
  console.log('[IPC] minimize-app received');
  app.hide();
});

// Handlers de banco
ipcMain.handle('getAllLists', async () => await getAllLists());
ipcMain.handle('addList', async (_, list) => await addList(list));
ipcMain.handle('deleteList', async (_, listId) => await deleteList(listId));
ipcMain.handle('deleteTask', async (_, taskId) => await deleteTask(taskId));
ipcMain.handle('getListById', async (event, id) => {return await getListById(id);});
ipcMain.handle('updateList', async (event, list) => {return await updateList(list);});


