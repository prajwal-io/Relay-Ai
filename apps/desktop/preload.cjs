const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('relayDesktop', {
  expand: value => ipcRenderer.invoke('relay:expand', value),
  workflow: value => ipcRenderer.invoke('relay:workflow', value),
  listChats: () => ipcRenderer.invoke('relay:chats'),
  readChat: id => ipcRenderer.invoke('relay:read-chat', id),
  prepareChat: text => ipcRenderer.invoke('relay:prepare-chat', text),
  openOpenCode: id => ipcRenderer.invoke('relay:open-opencode', id),
  showHandoffFile: () => ipcRenderer.invoke('relay:show-handoff-file'),
  moveBy: (dx, dy) => ipcRenderer.invoke('relay:move-by', dx, dy),
  openDashboard: () => ipcRenderer.invoke('relay:open-dashboard'),
  hide: () => ipcRenderer.invoke('relay:hide'),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('relay:state', listener);
    return () => ipcRenderer.removeListener('relay:state', listener);
  }
});
