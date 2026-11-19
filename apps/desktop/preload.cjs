const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('relayDesktop', {
  isDesktopApp: true,
  expand: value => ipcRenderer.invoke('relay:expand', value),
  workflow: value => ipcRenderer.invoke('relay:workflow', value),
  listChats: () => ipcRenderer.invoke('relay:chats'),
  readChat: id => ipcRenderer.invoke('relay:read-chat', id),
  prepareChat: text => ipcRenderer.invoke('relay:prepare-chat', text),
  openOpenCode: (id, mode = 'terminal') => ipcRenderer.invoke('relay:open-opencode', id, mode),
  moveBy: (dx, dy) => ipcRenderer.invoke('relay:move-by', dx, dy),
  openDashboard: () => ipcRenderer.invoke('relay:open-dashboard'),
  onAuthCallback: callback => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('relay:auth-callback', listener);
    return () => ipcRenderer.removeListener('relay:auth-callback', listener);
  },
  hide: () => ipcRenderer.invoke('relay:hide'),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('relay:state', listener);
    return () => ipcRenderer.removeListener('relay:state', listener);
  }
});
