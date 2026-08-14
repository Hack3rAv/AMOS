import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import fs from 'fs';
import https from 'https';
import EventEmitter from 'events';
import net from 'net';

export const SERVER_DIR = path.join(__dirname, '..', '..', 'server_data');
const JAR_FILE = path.join(SERVER_DIR, 'server.jar');
const PAPER_VERSION = '1.20.6';

export const serverEvents = new EventEmitter();
let serverProcess: ChildProcessWithoutNullStreams | null = null;
let currentStatus: 'offline' | 'starting' | 'online' = 'offline';
let isDownloading = false;
const consoleBuffer: string[] = [];
const onlinePlayers = new Set<string>();
export const playerLocations: Record<string, { x: number, y: number, z: number }> = {};
let locationInterval: NodeJS.Timeout | null = null;
let listInterval: NodeJS.Timeout | null = null;
let lastEntityDataPlayer: string | null = null;

let lastRamMB = '2048';

// Ensure server directory exists
if (!fs.existsSync(SERVER_DIR)) {
    fs.mkdirSync(SERVER_DIR, { recursive: true });
}

export async function downloadPaperMC(): Promise<void> {
    if (fs.existsSync(JAR_FILE)) {
        try {
            const stats = fs.statSync(JAR_FILE);
            if (stats.size > 1000000) return; // File exists and is > 1MB
            serverEvents.emit('console', 'Existing server.jar is incomplete/corrupted. Re-downloading...\n');
            fs.unlinkSync(JAR_FILE);
        } catch (e) {}
    }

    if (isDownloading) return;
    isDownloading = true;
    serverEvents.emit('console', 'Downloading PaperMC ' + PAPER_VERSION + '...\n');

    const downloadFileFromUrl = (url: string, targetPath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            const req = https.get(url, {
                headers: { 'User-Agent': 'MinePanel/1.0.0 (contact@example.com)' }
            }, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return downloadFileFromUrl(res.headers.location, targetPath).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP status code ${res.statusCode}`));
                }

                const file = fs.createWriteStream(targetPath);
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
                file.on('error', (err) => {
                    fs.unlink(targetPath, () => {});
                    reject(err);
                });
            });
            req.on('error', (err) => {
                fs.unlink(targetPath, () => {});
                reject(err);
            });
        });
    };

    try {
        const buildsUrl = `https://fill.papermc.io/v3/projects/paper/versions/${PAPER_VERSION}/builds`;
        const apiData: string = await new Promise((resolve, reject) => {
            https.get(buildsUrl, {
                headers: { 'User-Agent': 'MinePanel/1.0.0 (contact@example.com)' }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });

        let parsed: any;
        try {
            parsed = JSON.parse(apiData);
        } catch (e) {
            throw new Error('Failed to parse PaperMC API response.');
        }

        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('No PaperMC builds found.');
        }

        const latestBuild = parsed[0];
        const buildNum = latestBuild.id;
        const downloadUrl = latestBuild.downloads['server:default']?.url;

        if (!downloadUrl) {
            throw new Error('PaperMC download URL not found in API response.');
        }

        serverEvents.emit('console', `Found PaperMC build #${buildNum}. Downloading JAR...\n`);
        await downloadFileFromUrl(downloadUrl, JAR_FILE);

        serverEvents.emit('console', 'Download complete!\n');
        fs.writeFileSync(path.join(SERVER_DIR, 'eula.txt'), 'eula=true');
    } catch (err: any) {
        serverEvents.emit('console', `Download error: ${err.message}\n`);
        if (fs.existsSync(JAR_FILE)) {
            try { fs.unlinkSync(JAR_FILE); } catch (e) {}
        }
        throw err;
    } finally {
        isDownloading = false;
    }
}

import { execSync } from 'child_process';

function freePort25565() {
    try {
        if (process.platform === 'win32') {
            const out = execSync('netstat -ano | findstr :25565', { encoding: 'utf-8' });
            const lines = out.split('\n');
            for (const line of lines) {
                if (line.includes('LISTENING')) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && pid !== '0') {
                        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                    }
                }
            }
        } else {
            try {
                execSync('fuser -k 25565/tcp', { stdio: 'ignore' });
            } catch (e) {}
        }
    } catch (e) {}
}

export async function startServer(ramMB?: string): Promise<void> {
    if (ramMB) lastRamMB = ramMB;
    
    if (serverProcess) {
        serverEvents.emit('console', 'Server is already running!\n');
        return;
    }

    // Ensure port 25565 is not occupied by an orphaned java process
    if (serverProcess && serverProcess.pid) {
        try {
            if (process.platform === 'win32') {
                execSync(`taskkill /F /PID ${serverProcess.pid} /T`, { stdio: 'ignore' });
            } else {
                process.kill(serverProcess.pid, 'SIGKILL');
            }
        } catch(e) {}
        serverProcess = null;
    }
    freePort25565();

    if (!fs.existsSync(JAR_FILE) || fs.statSync(JAR_FILE).size < 1000000) {
        await downloadPaperMC();
    }

    currentStatus = 'starting';
    serverEvents.emit('status', currentStatus);
    serverEvents.emit('console', `Starting server with ${lastRamMB}MB RAM...\n`);
    
    serverProcess = spawn('java', [
        `-Xms${lastRamMB}M`,
        `-Xmx${lastRamMB}M`,
        '-jar',
        'server.jar',
        'nogui'
    ], {
        cwd: SERVER_DIR
    });

    if (listInterval) clearInterval(listInterval);
    listInterval = setInterval(() => {
        if (serverProcess && serverProcess.stdin && currentStatus === 'online') {
            serverProcess.stdin.write('list\n');
        }
    }, 5000);

    // Start location tracking loop
    if (locationInterval) clearInterval(locationInterval);
    locationInterval = setInterval(() => {
        if (serverProcess && currentStatus === 'online') {
            serverProcess.stdin?.write('execute as @a run data get entity @s Pos\n');
        }
    }, 2000);

    // Port 25565 listener fallback check while starting
    const checkPortInterval = setInterval(() => {
        if (currentStatus !== 'starting') {
            clearInterval(checkPortInterval);
            return;
        }
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
            socket.destroy();
            if (currentStatus === 'starting') {
                currentStatus = 'online';
                serverEvents.emit('status', currentStatus);
            }
            clearInterval(checkPortInterval);
        });
        socket.on('error', () => socket.destroy());
        socket.on('timeout', () => socket.destroy());
        socket.connect(25565, '127.0.0.1');
    }, 2000);

    let stdoutBuffer = '';
    serverProcess.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
        let newlineIndex;
        
        while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
            const line = stdoutBuffer.slice(0, newlineIndex); // exclude \n for parsing
            stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
            
            if (!line.trim()) continue;
            
            // Intercept and hide coordinate data
            const cleanLine = line.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

            // Detect PaperMC startup completion: "Done (XX.XXs)!" or "For help, type "help""
            if (currentStatus === 'starting' && (cleanLine.includes('Done (') || cleanLine.includes('For help, type "help"'))) {
                currentStatus = 'online';
                serverEvents.emit('status', currentStatus);
                serverEvents.emit('console', '[MINEPANEL] Server startup complete! Server is now ONLINE.\n');
            }
            const entityDataMatch = cleanLine.match(/([a-zA-Z0-9_]+) has the following entity data:/);
            if (entityDataMatch) {
                lastEntityDataPlayer = entityDataMatch[1];
                continue; // Do not send to console
            }

            if (lastEntityDataPlayer) {
                const posMatch = cleanLine.match(/\[([-0-9.]+)[dD],\s*([-0-9.]+)[dD],\s*([-0-9.]+)[dD]\]/);
                if (posMatch) {
                    playerLocations[lastEntityDataPlayer] = {
                        x: parseFloat(posMatch[1]),
                        y: parseFloat(posMatch[2]),
                        z: parseFloat(posMatch[3])
                    };
                    lastEntityDataPlayer = null;
                    continue; // Do not send to console
                }
                lastEntityDataPlayer = null; // Reset if it was something else
            }
            
            // Intercept list command output
            const listMatch = cleanLine.match(/players online:(.*)/);
            if (listMatch) {
                const playersStr = listMatch[1].trim();
                const players = playersStr ? playersStr.split(',').map(p => p.trim()) : [];
                
                const currentOnline = new Set(players);
                onlinePlayers.clear();
                currentOnline.forEach(p => onlinePlayers.add(p));
                
                // Cleanup disconnected players from locations
                for (const p in playerLocations) {
                    if (!onlinePlayers.has(p)) delete playerLocations[p];
                }
                continue; // Do not send to console
            }
            
            // Track players
            const joinMatch = line.match(/([a-zA-Z0-9_]{3,16}) joined the game/);
            const leaveMatch = line.match(/([a-zA-Z0-9_]{3,16}) left the game/);
            if (joinMatch) onlinePlayers.add(joinMatch[1]);
            if (leaveMatch) {
                onlinePlayers.delete(leaveMatch[1]);
                delete playerLocations[leaveMatch[1]];
            }

            const outLine = line + '\n';
            consoleBuffer.push(outLine);
            if (consoleBuffer.length > 100) consoleBuffer.shift();
            serverEvents.emit('console', outLine);
        }
    });

    serverProcess.stderr.on('data', (data) => {
        const str = data.toString();
        consoleBuffer.push(str);
        if (consoleBuffer.length > 100) consoleBuffer.shift();
        serverEvents.emit('console', str);
    });

    const handleProcessEnd = (code: number | null, signal?: string) => {
        if (locationInterval) clearInterval(locationInterval);
        if (listInterval) clearInterval(listInterval);
        currentStatus = 'offline';
        serverProcess = null;
        onlinePlayers.clear();
        for (const key in playerLocations) delete playerLocations[key];
        serverEvents.emit('status', currentStatus);
        serverEvents.emit('console', `\n[MinePanel] Server process terminated (code ${code ?? 'unknown'}${signal ? `, signal ${signal}` : ''}). Status: OFFLINE\n`);
    };

    serverProcess.on('close', (code) => handleProcessEnd(code));
    serverProcess.on('exit', (code, signal) => handleProcessEnd(code, signal || undefined));
    serverProcess.on('error', (err) => {
        serverEvents.emit('console', `\n[MinePanel] Process error: ${err.message}\n`);
        handleProcessEnd(-1);
    });
}

export function stopServer() {
    if (!serverProcess) {
        killServer();
        return;
    }
    serverEvents.emit('console', 'Stopping server...\n');
    serverProcess.stdin.write('stop\n');
}

export function killServer() {
    serverEvents.emit('console', 'Killing server process...\n');
    // Only kill the server process by PID — NOT all java.exe (that kills TLauncher too!)
    if (serverProcess && serverProcess.pid) {
        try {
            if (process.platform === 'win32') {
                execSync(`taskkill /F /PID ${serverProcess.pid} /T`, { stdio: 'ignore' });
            } else {
                process.kill(serverProcess.pid, 'SIGKILL');
            }
        } catch(e) {}
    }
    freePort25565();
    
    if (serverProcess) {
        serverProcess = null;
    }
    currentStatus = 'offline';
    serverEvents.emit('status', currentStatus);
}

export async function restartServer(): Promise<void> {
    if (currentStatus === 'offline') {
        await startServer(lastRamMB);
    } else {
        serverEvents.emit('console', 'Restarting server...\n');
        stopServer();
        if (serverProcess) {
            serverProcess.once('close', () => {
                setTimeout(() => startServer(lastRamMB), 1000); // Wait 1 second before starting again
            });
        }
    }
}

export function sendCommand(command: string) {
    if (serverProcess && serverProcess.stdin) {
        const cleanCommand = command.startsWith('/') ? command.substring(1) : command;
        serverProcess.stdin.write(cleanCommand + '\n');
        
        const echo = `> ${cleanCommand}\n`;
        consoleBuffer.push(echo);
        if (consoleBuffer.length > 100) consoleBuffer.shift();
        serverEvents.emit('console', echo);
    } else {
        serverEvents.emit('console', 'Server is offline. Cannot send command.\n');
    }
}

export async function getStatus(): Promise<string> {
    if (!serverProcess) {
        currentStatus = 'offline';
        return 'offline';
    }

    if (currentStatus === 'starting') {
        return 'starting';
    }

    // Actively verify TCP socket port 25565
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800);
        socket.on('connect', () => {
            socket.destroy();
            if (currentStatus !== 'online') {
                currentStatus = 'online';
                serverEvents.emit('status', 'online');
            }
            resolve('online');
        });
        socket.on('timeout', () => {
            socket.destroy();
            if (currentStatus === 'online') {
                currentStatus = 'offline';
                serverEvents.emit('status', 'offline');
            }
            resolve('offline');
        });
        socket.on('error', () => {
            socket.destroy();
            if (currentStatus === 'online') {
                currentStatus = 'offline';
                serverEvents.emit('status', 'offline');
            }
            resolve('offline');
        });
        socket.connect(25565, '127.0.0.1');
    });
}

export function getProcessPid(): number | undefined {
    return serverProcess?.pid;
}

export function getConsoleBuffer(): string[] {
    return consoleBuffer;
}

export function getOnlinePlayers(): string[] {
    return Array.from(onlinePlayers);
}
