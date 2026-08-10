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
    if (fs.existsSync(JAR_FILE)) return;
    if (isDownloading) return;
    isDownloading = true;
    serverEvents.emit('console', 'Downloading PaperMC ' + PAPER_VERSION + '...\n');

    return new Promise((resolve, reject) => {
        // 1. Get latest build
        const options = {
            hostname: 'fill.papermc.io',
            path: `/v3/projects/paper/versions/${PAPER_VERSION}/builds`,
            headers: {
                'User-Agent': 'MinePanel/1.0.0 (contact@example.com)'
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    isDownloading = false;
                    serverEvents.emit('console', 'Failed to parse API response.\n');
                    return reject(e);
                }

                if (!Array.isArray(parsed) || parsed.length === 0) {
                    isDownloading = false;
                    serverEvents.emit('console', 'Error fetching builds! API response: ' + data.substring(0, 50) + '\n');
                    return reject(new Error('No builds found'));
                }
                const latestBuild = parsed[0];
                const buildNum = latestBuild.id;
                const downloadName = latestBuild.downloads['server:default'].name;
                const downloadUrl = latestBuild.downloads['server:default'].url;
                
                serverEvents.emit('console', `Found build ${buildNum}. Downloading JAR...\n`);
                
                const file = fs.createWriteStream(JAR_FILE);
                https.get(downloadUrl, {
                    headers: { 'User-Agent': 'MinePanel/1.0.0 (contact@example.com)' }
                }, (downloadRes) => {
                    downloadRes.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        isDownloading = false;
                        serverEvents.emit('console', 'Download complete!\n');
                        // Auto accept EULA
                        fs.writeFileSync(path.join(SERVER_DIR, 'eula.txt'), 'eula=true');
                        resolve();
                    });
                }).on('error', (err) => {
                    isDownloading = false;
                    fs.unlinkSync(JAR_FILE);
                    serverEvents.emit('console', `Download error: ${err.message}\n`);
                    reject(err);
                });
            });
        }).on('error', (err) => {
            isDownloading = false;
            serverEvents.emit('console', `API error: ${err.message}\n`);
            reject(err);
        });
    });
}

import { execSync } from 'child_process';

function freePort25565() {
    try {
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
            execSync(`taskkill /F /PID ${serverProcess.pid} /T`, { stdio: 'ignore' });
        } catch(e) {}
        serverProcess = null;
    }
    freePort25565();


    if (!fs.existsSync(JAR_FILE)) {
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
            execSync(`taskkill /F /PID ${serverProcess.pid} /T`, { stdio: 'ignore' });
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
