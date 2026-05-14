const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('index.html');
  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);

ipcMain.handle('escolher-pasta', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Escolha a pasta para salvar os lançamentos',
    properties: ['openDirectory', 'createDirectory']
  });
  if (!canceled && filePaths[0]) {
    store.set('pastaBackup', filePaths[0]);
    return filePaths[0];
  }
  return store.get('pastaBackup');
});

ipcMain.handle('salvar-backup', async (event, dados) => {
  let pasta = store.get('pastaBackup');
  if (!pasta) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Escolha onde salvar a base de dados',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled) return { sucesso: false, erro: 'Pasta nao selecionada' };
    pasta = filePaths[0];
    store.set('pastaBackup', pasta);
  }
  try {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, dados.nome), dados.conteudo, 'utf8');
    return { sucesso: true, pasta: pasta };
  } catch (e) {
    return { sucesso: false, erro: e.message };
  }
});

ipcMain.handle('get-pasta', () => store.get('pastaBackup') || null);