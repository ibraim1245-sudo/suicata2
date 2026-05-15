const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

app.setName('PCP');

const configPath = path.join(app.getPath('userData'), 'config.json');

function configPadrao() {
  return {
    usuarios: [
      {
        usuario: 'admin',
        senha: 'admin',
        admin: true
      }
    ],
    pastaBackup: null,
    tema: 'claro',
    logo: null,
    compras: []
  };
}

function salvarConfig(config) {

  try {

    fs.mkdirSync(path.dirname(configPath), {
      recursive: true
    });

    fs.writeFileSync(
      configPath,
      JSON.stringify(config, null, 2),
      'utf8'
    );

  } catch (e) {

    console.error('Erro ao salvar config:', e);

  }

}

function lerConfig() {

  try {

    if (!fs.existsSync(configPath)) {

      const config = configPadrao();

      salvarConfig(config);

      return config;
    }

    const conteudo = fs.readFileSync(configPath, 'utf8');

    if (!conteudo || conteudo.trim() === '') {

      const config = configPadrao();

      salvarConfig(config);

      return config;
    }

    return JSON.parse(conteudo);

  } catch (e) {

    console.error('Erro ao ler config:', e);

    const config = configPadrao();

    salvarConfig(config);

    return config;
  }

}

let mainWindow = null;

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

  // DEBUG
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.on(
    'did-fail-load',
    (event, code, desc) => {

      console.error('Erro carregamento:', code, desc);

    }
  );

  mainWindow.on('closed', () => {

    mainWindow = null;

  });

}

app.whenReady().then(() => {

  lerConfig();

  createWindow();

});

ipcMain.handle('login', async (event, user, pass) => {

  try {

    const config = lerConfig();

    const achou = config.usuarios.find(u =>
      String(u.usuario).trim() === String(user).trim() &&
      String(u.senha).trim() === String(pass).trim()
    );

    if (achou) {

      return {
        sucesso: true,
        usuario: achou.usuario,
        admin: achou.admin || false
      };

    }

    return {
      sucesso: false,
      erro: 'Usuário ou senha inválidos'
    };

  } catch (e) {

    console.error('Erro login:', e);

    return {
      sucesso: false,
      erro: e.message
    };

  }

});

ipcMain.handle('salvar-usuarios', async (event, usuarios) => {

  try {

    const config = lerConfig();

    config.usuarios = usuarios;

    salvarConfig(config);

    return {
      sucesso: true
    };

  } catch (e) {

    console.error(e);

    return {
      sucesso: false,
      erro: e.message
    };

  }

});

ipcMain.handle('get-usuarios', async () => {

  try {

    return lerConfig().usuarios || [];

  } catch (e) {

    console.error(e);

    return [];

  }

});

ipcMain.handle('get-config', async () => {

  try {

    return lerConfig();

  } catch (e) {

    console.error(e);

    return configPadrao();

  }

});

ipcMain.handle('salvar-tema', async (event, tema) => {

  try {

    const config = lerConfig();

    config.tema = tema;

    salvarConfig(config);

    return {
      sucesso: true
    };

  } catch (e) {

    console.error(e);

    return {
      sucesso: false,
      erro: e.message
    };

  }

});

ipcMain.handle('upload-logo', async () => {

  try {

    const { canceled, filePaths } =
      await dialog.showOpenDialog({

        title: 'Escolher Logo da Empresa',

        filters: [
          {
            name: 'Imagens',
            extensions: ['png', 'jpg', 'jpeg']
          }
        ],

        properties: ['openFile']

      });

    if (canceled || !filePaths.length) {

      return {
        sucesso: false
      };

    }

    const logoPath = filePaths[0];

    const ext = path.extname(logoPath);

    const dest = path.join(
      app.getPath('userData'),
      'logo' + ext
    );

    fs.copyFileSync(logoPath, dest);

    const config = lerConfig();

    config.logo = dest;

    salvarConfig(config);

    return {
      sucesso: true,
      caminho: dest
    };

  } catch (e) {

    console.error(e);

    return {
      sucesso: false,
      erro: e.message
    };

  }

});

ipcMain.handle('salvar-compra', async (event, compra) => {

  try {

    const config = lerConfig();

    if (!config.compras) {
      config.compras = [];
    }

    const idx = config.compras.findIndex(
      c => c.mes === compra.mes
    );

    if (idx >= 0) {
      config.compras[idx] = compra;
    } else {
      config.compras.push(compra);
    }

    salvarConfig(config);

    return {
      sucesso: true
    };

  } catch (e) {

    console.error(e);

    return {
      sucesso: false,
      erro: e.message
    };

  }

});

ipcMain.handle(
  'alterar-senha',
  async (event, usuario, senhaAtual, novaSenha) => {

    try {

      const config = lerConfig();

      const user = config.usuarios.find(
        u => u.usuario === usuario
      );

      if (!user) {

        return {
          sucesso: false,
          erro: 'Usuário não encontrado'
        };

      }

      if (user.senha !== senhaAtual) {

        return {
          sucesso: false,
          erro: 'Senha atual incorreta'
        };

      }

      user.senha = novaSenha;

      salvarConfig(config);

      return {
        sucesso: true
      };

    } catch (e) {

      console.error(e);

      return {
        sucesso: false,
        erro: e.message
      };

    }

  }
);

ipcMain.handle(
  'alterar-senha-admin',
  async (event, usuario, novaSenha) => {

    try {

      const config = lerConfig();

      const user = config.usuarios.find(
        u => u.usuario === usuario
      );

      if (!user) {

        return {
          sucesso: false,
          erro: 'Usuário não encontrado'
        };

      }

      user.senha = novaSenha;

      salvarConfig(config);

      return {
        sucesso: true
      };

    } catch (e) {

      console.error(e);

      return {
        sucesso: false,
        erro: e.message
      };

    }

  }
);

ipcMain.handle('escolher-pasta', async () => {

  try {

    const { canceled, filePaths } =
      await dialog.showOpenDialog({

        title: 'Escolha a pasta para salvar os lançamentos',

        properties: [
          'openDirectory',
          'createDirectory'
        ]

      });

    const config = lerConfig();

    if (!canceled && filePaths[0]) {

      config.pastaBackup = filePaths[0];

      salvarConfig(config);

      return filePaths[0];
    }

    return config.pastaBackup || null;

  } catch (e) {

    console.error(e);

    return null;

  }

});

ipcMain.handle('get-pasta', async () => {

  try {

    return lerConfig().pastaBackup || null;

  } catch (e) {

    console.error(e);

    return null;

  }

});

ipcMain.handle(
  'salvar-backup',
  async (event, dados) => {

    try {

      const config = lerConfig();

      const pasta = config.pastaBackup;

      if (!pasta) {

        return {
          sucesso: false,
          erro: 'Pasta não configurada'
        };

      }

      if (!fs.existsSync(pasta)) {

        fs.mkdirSync(pasta, {
          recursive: true
        });

      }

      fs.writeFileSync(
        path.join(pasta, dados.nome),
        dados.conteudo,
        'utf8'
      );

      return {
        sucesso: true,
        pasta
      };

    } catch (e) {

      console.error(e);

      return {
        sucesso: false,
        erro: e.message
      };

    }

  }
);

ipcMain.handle('ler-pasta', async (event, pasta) => {

  try {

    if (!fs.existsSync(pasta)) {
      return [];
    }

    const arquivos = fs.readdirSync(pasta)
      .filter(f =>
        f.startsWith('LAN-') &&
        f.endsWith('.json')
      );

    const lancamentos = [];

    for (const arquivo of arquivos) {

      try {

        const conteudo = fs.readFileSync(
          path.join(pasta, arquivo),
          'utf8'
        );

        const json = JSON.parse(conteudo);

        if (json.id) {
          lancamentos.push(json);
        }

      } catch (e) {

        console.error(
          'Erro arquivo:',
          arquivo,
          e
        );

      }

    }

    return lancamentos;

  } catch (e) {

    console.error(e);

    return [];

  }

});

ipcMain.handle(
  'exportar-excel',
  async (event, dados, nomeArquivo) => {

    try {

      const { canceled, filePath } =
        await dialog.showSaveDialog({

          title: 'Salvar Excel',

          defaultPath:
            nomeArquivo || 'relatorio.xlsx',

          filters: [
            {
              name: 'Excel',
              extensions: ['xlsx']
            }
          ]

        });

      if (canceled || !filePath) {

        return {
          sucesso: false
        };

      }

      const ws =
        XLSX.utils.json_to_sheet(dados);

      const wb =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        'Dados'
      );

      XLSX.writeFile(wb, filePath);

      return {
        sucesso: true,
        caminho: filePath
      };

    } catch (e) {

      console.error(e);

      return {
        sucesso: false,
        erro: e.message
      };

    }

  }
);

ipcMain.handle(
  'abrir-email',
  async (event, assunto, corpo, anexo) => {

    try {

      const url =
        `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

      await shell.openExternal(url);

      if (anexo) {

        shell.showItemInFolder(anexo);

      }

      return {
        sucesso: true
      };

    } catch (e) {

      console.error(e);

      return {
        sucesso: false,
        erro: e.message
      };

    }

  }
);

app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') {

    app.quit();

  }

});

process.on('uncaughtException', err => {

  console.error('Erro não tratado:', err);

});

process.on('unhandledRejection', err => {

  console.error('Promise rejeitada:', err);

});
