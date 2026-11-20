const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('relayDesktop', {
  isDesktopApp: true,
  exportReceiver: id => ipcRenderer.invoke('relay:export-receiver', id),
  expand: value => ipcRenderer.invoke('relay:expand', value),
  workflow: value => ipcRenderer.invoke('relay:workflow', value),
  listChats: () => ipcRenderer.invoke('relay:chats'),
  readChat: id => ipcRenderer.invoke('relay:read-chat', id),
  prepareChat: text => ipcRenderer.invoke('relay:prepare-chat', text),
  openOpenCode: (id, mode = 'terminal') => ipcRenderer.invoke('relay:open-opencode', id, mode),
  moveBy: (dx, dy) => ipcRenderer.invoke('relay:move-by', dx, dy),
  openDashboard: studio => ipcRenderer.invoke('relay:open-dashboard', studio === true),
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
