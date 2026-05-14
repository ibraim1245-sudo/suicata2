const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

// Arquivo de config fica em: C:\Users\Processos03\AppData\Roaming\Controle de Sucata\config.json
const configPath = path.join(app.getPath('userData'), 'config.json');

function lerConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function salvarConfig(config) {
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {}
}

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
  const config = lerConfig();
  if (!canceled && filePaths[0]) {
    config.pastaBackup = filePaths[0];
    salvarConfig(config);
    return filePaths[0];
  }
  return config.pastaBackup || null;
});

ipcMain.handle('salvar-backup', async (event, dados) => {
  const config = lerConfig();
  let pasta = config.pastaBackup;
  if (!pasta) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Escolha onde salvar a base de dados',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled) return { sucesso: false, erro: 'Pasta nao selecionada' };
    pasta = filePaths[0];
    config.pastaBackup = pasta;
    salvarConfig(config);
  }
  try {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, dados.nome), dados.conteudo, 'utf8');
    return { sucesso: true, pasta: pasta };
  } catch (e) {
    return { sucesso: false, erro: e.message };
  }
});

ipcMain.handle('get-pasta', () => {
  const config = lerConfig();
  return config.pastaBackup || null;
});
