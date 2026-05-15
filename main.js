const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const configPath = path.join(app.getPath('userData'), 'config.json');

function lerConfig() {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {}
  return {
    usuarios: [{usuario: 'admin', senha: 'admin', admin: true}],
    pastaBackup: null,
    tema: 'claro',
    logo: null,
    compras: []
  };
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
    width: 1500,
    height: 950,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('index.html');
  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);

ipcMain.handle('login', (event, user, pass) => {
  const config = lerConfig();
  const achou = config.usuarios.find(u => u.usuario === user && u.senha === pass);
  return achou? { sucesso: true, usuario: user, admin: achou.admin || false } : { sucesso: false };
});

ipcMain.handle('salvar-usuarios', (event, usuarios) => {
  const config = lerConfig();
  config.usuarios = usuarios;
  salvarConfig(config);
  return { sucesso: true };
});

ipcMain.handle('get-usuarios', () => {
  return lerConfig().usuarios || [];
});

ipcMain.handle('get-config', () => {
  return lerConfig();
});

ipcMain.handle('salvar-tema', (event, tema) => {
  const config = lerConfig();
  config.tema = tema;
  salvarConfig(config);
  return { sucesso: true };
});

ipcMain.handle('upload-logo', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Escolher Logo da Empresa',
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile']
  });
  if (canceled) return { sucesso: false };
  try {
    const logoPath = filePaths[0];
    const ext = path.extname(logoPath);
    const dest = path.join(app.getPath('userData'), 'logo' + ext);
    fs.copyFileSync(logoPath, dest);
    const config = lerConfig();
    config.logo = dest;
    salvarConfig(config);
    return { sucesso: true, caminho: dest };
  } catch (e) {
    return { sucesso: false, erro: e.message };
  }
});

ipcMain.handle('salvar-compra', async (event, compra) => {
  const config = lerConfig();
  if (!config.compras) config.compras = [];
  const idx = config.compras.findIndex(c => c.mes === compra.mes);
  if (idx >= 0) config.compras[idx] = compra;
  else config.compras.push(compra);
  salvarConfig(config);
  return { sucesso: true };
});

ipcMain.handle('alterar-senha', (event, usuario, senhaAtual, novaSenha) => {
  const config = lerConfig();
  const user = config.usuarios.find(u => u.usuario === usuario);
  if (!user) return { sucesso: false, erro: 'Usuario nao encontrado' };
  if (user.senha!== senhaAtual) return { sucesso: false, erro: 'Senha atual incorreta' };
  user.senha = novaSenha;
  salvarConfig(config);
  return { sucesso: true };
});

ipcMain.handle('alterar-senha-admin', (event, usuario, novaSenha) => {
  const config = lerConfig();
  const user = config.usuarios.find(u => u.usuario === usuario);
  if (!user) return { sucesso: false, erro: 'Usuario nao encontrado' };
  user.senha = novaSenha;
  salvarConfig(config);
  return { sucesso: true };
});

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

ipcMain.handle('get-pasta', () => {
  return lerConfig().pastaBackup || null;
});

ipcMain.handle('salvar-backup', async (event, dados) => {
  const config = lerConfig();
  let pasta = config.pastaBackup;
  if (!pasta) return { sucesso: false, erro: 'Pasta nao configurada em Configuracoes' };
  try {
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, dados.nome), dados.conteudo, 'utf8');
    return { sucesso: true, pasta: pasta };
  } catch (e) {
    return { sucesso: false, erro: e.message };
  }
});

ipcMain.handle('ler-pasta', async (event, pasta) => {
  try {
    if (!fs.existsSync(pasta)) return [];
    const arquivos = fs.readdirSync(pasta).filter(f => f.startsWith('LAN-') && f.endsWith('.json'));
    const lancamentos = [];
    arquivos.forEach(arquivo => {
      try {
        const conteudo = fs.readFileSync(path.join(pasta, arquivo), 'utf8');
        const json = JSON.parse(conteudo);
        if (json.id) lancamentos.push(json);
      } catch (e) {}
    });
    return lancamentos;
  } catch (e) {
    return [];
  }
});

ipcMain.handle('exportar-excel', async (event, dados, nomeArquivo) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Salvar Excel',
    defaultPath: nomeArquivo || 'relatorio.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (canceled) return { sucesso: false };
  try {
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, filePath);
    return { sucesso: true, caminho: filePath };
  } catch (e) {
    return { sucesso: false, erro: e.message };
  }
});

ipcMain.handle('abrir-email', async (event, assunto, corpo, anexo) => {
  const url = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  shell.openExternal(url);
  if (anexo) shell.showItemInFolder(anexo);
  return { sucesso: true };
});

app.on('window-all-closed', () => {
  if (process.platform!== 'darwin') app.quit();
});
