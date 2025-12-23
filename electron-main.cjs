const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'dist', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webgl: true 
    }
  })

  // 1. 彻底隐藏菜单栏
  win.setMenu(null); 

  // 2. 加载页面
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  
  // 3. 【核心代码】手动监听键盘事件，实现快捷键
  win.webContents.on('before-input-event', (event, input) => {
    // 监听 F12 打开调试工具
    if (input.key === 'F12' && input.type === 'keyDown') {
      win.webContents.toggleDevTools();
      event.preventDefault(); 
    }

    // 监听 Ctrl + Shift + I 打开调试工具
    if (input.control && input.shift && input.key.toLowerCase() === 'i' && input.type === 'keyDown') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }

    // (可选) 监听 Ctrl + R 刷新页面，方便你调试
    if (input.control && input.key.toLowerCase() === 'r' && input.type === 'keyDown') {
      win.reload();
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})