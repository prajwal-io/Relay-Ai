const { spawn } = require('node:child_process');

function shellQuote(value) { return `'${String(value).replace(/'/g, "'\\''")}'`; }
function appleScriptString(value) { return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`; }

function launchOpenCode({ platform = process.platform, command, projectPath, bridgeUrl, prompt, password, spawnProcess = spawn }) {
  const args = ['--server', bridgeUrl, '--prompt', prompt];
  let child;
  if (platform === 'win32') {
    const psQuote = value => `'${String(value).replace(/'/g, "''")}'`;
    const script = `Set-Location -LiteralPath ${psQuote(projectPath)}; $env:OPENCODE_PASSWORD=${psQuote(password)}; & ${psQuote(command)} ${args.map(psQuote).join(' ')}`;
    child = spawnProcess('powershell.exe', ['-NoProfile', '-NoExit', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { cwd: projectPath, env: process.env, windowsHide: false, detached: true, stdio: 'ignore' });
  } else if (platform === 'darwin') {
    const line = `cd ${shellQuote(projectPath)} && export OPENCODE_PASSWORD=${shellQuote(password)} && ${[command, ...args].map(shellQuote).join(' ')}`;
    child = spawnProcess('osascript', ['-e', `tell application "Terminal" to do script ${appleScriptString(line)}`], { cwd: projectPath, env: process.env, detached: true, stdio: 'ignore' });
  } else if (platform === 'linux') {
    const shell = `cd ${shellQuote(projectPath)} && export OPENCODE_PASSWORD=${shellQuote(password)} && exec ${[command, ...args].map(shellQuote).join(' ')}`;
    child = spawnProcess('x-terminal-emulator', ['-e', 'sh', '-lc', shell], { cwd: projectPath, env: process.env, detached: true, stdio: 'ignore' });
  } else throw new Error(`Relay's desktop launcher does not support ${platform}.`);
  child.unref?.();
  return child;
}

module.exports = { launchOpenCode, shellQuote, appleScriptString };
