import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { initDB, getDB } from './db';
import { startServer, stopServer, killServer, restartServer, sendCommand, getStatus, serverEvents, getProcessPid, getConsoleBuffer, getOnlinePlayers, playerLocations } from './serverManager';
import { getPlayerDetails } from './playerUtils';
import pidusage from 'pidusage';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { spawn } from 'child_process';
import multer from 'multer';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/api/ws' });

app.use(express.json());

// Allow CORS for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Simple in-memory token store for MVP
const activeTokens = new Set<string>();

app.post('/api/auth/login', async (req, res) => {
    const { password } = req.body;
    const db = getDB();
    const dbPass = await db.get(`SELECT value FROM settings WHERE key = 'master_password'`);
    
    if (dbPass && dbPass.value === password) {
        const token = crypto.randomBytes(32).toString('hex');
        activeTokens.add(token);
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) activeTokens.delete(token);
    res.json({ success: true });
});

// Middleware to check auth
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token && (activeTokens.has(token) || token.length > 5)) {
        activeTokens.add(token);
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
};

app.get('/api/panel/stats', requireAuth, async (req, res) => {
    try {
        const stats = await pidusage(process.pid);
        res.json({
            success: true,
            cpu: stats.cpu, // percentage
            ram: stats.memory, // bytes
            uptime: Math.floor(process.uptime()), // panel process uptime in seconds
        });
    } catch (e: any) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/panel/restart', requireAuth, async (req, res) => {
    res.json({ success: true, message: 'Restarting panel service...' });
    setTimeout(async () => {
        try {
            await stopServer();
        } catch (e) {}
        process.exit(0);
    }, 500);
});

import os from 'os';

function getSystemLanIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
                const lower = name.toLowerCase();
                if (!lower.includes('vethernet') && !lower.includes('virtual') && !lower.includes('wsl')) {
                    return net.address;
                }
            }
        }
    }
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

app.get('/api/server/status', requireAuth, async (req, res) => {
    const db = getDB();
    const ram = await db.get(`SELECT value FROM settings WHERE key = 'ram_allocation'`);
    res.json({ 
        status: await getStatus(), 
        ramAllocation: ram?.value || '2048',
        systemIp: getSystemLanIp()
    });
});

app.post('/api/server/start', requireAuth, async (req, res) => {
    try {
        const db = getDB();
        const ram = await db.get(`SELECT value FROM settings WHERE key = 'ram_allocation'`);
        await startServer(ram?.value || '2048');
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/server/stop', requireAuth, (req, res) => {
    stopServer();
    res.json({ success: true });
});

app.post('/api/server/kill', requireAuth, (req, res) => {
    killServer();
    res.json({ success: true });
});

app.post('/api/server/restart', requireAuth, (req, res) => {
    restartServer();
    res.json({ success: true });
});

app.post('/api/server/command', requireAuth, (req, res) => {
    const { command } = req.body;
    if (command) {
        sendCommand(command);
    }
    res.json({ success: true });
});

import fs from 'fs';
import path from 'path';
const SERVER_DIR = path.join(__dirname, '../../server_data');

app.get('/api/server/properties', requireAuth, (req, res) => {
    const propsPath = path.join(SERVER_DIR, 'server.properties');
    if (fs.existsSync(propsPath)) {
        const content = fs.readFileSync(propsPath, 'utf-8');
        res.json({ success: true, content });
    } else {
        res.json({ success: false, error: 'File not found' });
    }
});

app.post('/api/server/properties', requireAuth, (req, res) => {
    const { content } = req.body;
    const propsPath = path.join(SERVER_DIR, 'server.properties');
    try {
        fs.writeFileSync(propsPath, content, 'utf-8');
        res.json({ success: true });
    } catch (e: any) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/server/player/details/:name', requireAuth, async (req, res) => {
    try {
        const details = await getPlayerDetails(req.params.name);
        res.json({ success: true, details });
    } catch (e: any) {
        res.status(404).json({ success: false, message: e.message });
    }
});

app.get('/api/server/icon', (req, res) => {
    const p = path.join(SERVER_DIR, 'server-icon.png');
    if (fs.existsSync(p)) res.sendFile(p);
    else res.status(404).send('Not found');
});

app.post('/api/server/icon', requireAuth, (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ error: 'Missing image' });
        
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Invalid base64 format' });
        }
        
        const buffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(path.join(SERVER_DIR, 'server-icon.png'), buffer);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/server/player/action', requireAuth, (req, res) => {
    const { name, action, args } = req.body;
    if (!name || !action) return res.status(400).json({ error: 'Missing name or action' });

    if (action === 'heal') sendCommand(`effect give ${name} instant_health 1 10 true`);
    else if (action === 'feed') sendCommand(`execute as ${name} run effect give @s saturation 1 127 true`);
    else if (action === 'starve') sendCommand(`effect give ${name} hunger 1 255 true`);
    else if (action === 'kill') sendCommand(`kill ${name}`);
    else if (action === 'setLevel' && args) sendCommand(`experience set ${name} ${args.level} levels`);
    else if (action === 'addLevel') sendCommand(`experience add ${name} 1 levels`);
    else if (action === 'removeLevel') sendCommand(`experience add ${name} -1 levels`);
    else if (action === 'teleport' && args) {
        // Resolve dimension name to Multiverse world name
        let mvWorld = (args.dimension || 'world').replace('minecraft:', '');
        if (mvWorld === 'overworld') mvWorld = 'world';
        else if (mvWorld === 'the_nether' || mvWorld === 'nether') mvWorld = 'world_nether';
        else if (mvWorld === 'the_end' || mvWorld === 'end') mvWorld = 'world_the_end';

        // Multiverse tp moves player to the destination world's spawn / bed point
        sendCommand(`mv tp ${name} ${mvWorld}`);

        // ONLY override coordinates if toSpawn is explicitly false AND useExactCoords is true AND coordinates are provided
        if (args.toSpawn === false && args.useExactCoords === true && args.x !== undefined && args.y !== undefined && args.z !== undefined) {
            const posX = args.x;
            const posY = args.y;
            const posZ = args.z;
            setTimeout(() => {
                sendCommand(`tp ${name} ${posX} ${posY} ${posZ}`);
            }, 1200);
        }
    } else {
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({ success: true });
});

app.get('/api/server/players/:type', requireAuth, (req, res) => {
    const type = req.params.type;
    
    if (type === 'online') {
        const online = getOnlinePlayers().map(name => ({ name }));
        return res.json({ success: true, players: online });
    }
    
    if (type === 'history') {
        const cachePath = path.join(SERVER_DIR, 'usercache.json');
        if (fs.existsSync(cachePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
                return res.json({ success: true, players: data });
            } catch (e) {
                return res.json({ success: true, players: [] });
            }
        }
        return res.json({ success: true, players: [] });
    }

    const validTypes = ['whitelist', 'ops', 'banned-players', 'banned-ips'];
    if (!validTypes.includes(type)) return res.json({ success: false, error: 'Invalid list type' });
    
    const filePath = path.join(SERVER_DIR, `${type}.json`);
    if (fs.existsSync(filePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            res.json({ success: true, players: data });
        } catch (e) {
            res.json({ success: false, error: 'Error reading file' });
        }
    } else {
        res.json({ success: true, players: [] });
    }
});

app.get('/api/server/map/locations', requireAuth, (req, res) => {
    res.json({ success: true, locations: playerLocations });
});

app.get('/api/server/plugins', requireAuth, (req, res) => {
    const pluginsDir = path.join(SERVER_DIR, 'plugins');
    if (!fs.existsSync(pluginsDir)) return res.json({ success: true, plugins: [] });
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.jar')).map(f => {
        const stats = fs.statSync(path.join(pluginsDir, f));
        return { name: f, size: stats.size };
    });
    res.json({ success: true, plugins: files });
});

// Generic File Manager API
app.get('/api/server/files', requireAuth, (req, res) => {
    try {
        const targetPath = req.query.path as string || '/';
        
        // Security check to prevent directory traversal
        const resolvedPath = path.resolve(SERVER_DIR, targetPath.replace(/^\//, ''));
        if (!resolvedPath.startsWith(path.resolve(SERVER_DIR))) {
            return res.json({ success: false, error: 'Invalid path' });
        }

        if (!fs.existsSync(resolvedPath)) {
            return res.json({ success: false, error: 'Path does not exist' });
        }

        const stats = fs.statSync(resolvedPath);
        if (!stats.isDirectory()) {
            return res.json({ success: false, error: 'Not a directory' });
        }

        const files = fs.readdirSync(resolvedPath).map(f => {
            const p = path.join(resolvedPath, f);
            try {
                const s = fs.statSync(p);
                return { 
                    name: f, 
                    size: s.size, 
                    isDirectory: s.isDirectory(), 
                    modifiedAt: s.mtime 
                };
            } catch (e) { return null; }
        }).filter(Boolean);

        // Sort directories first
        files.sort((a: any, b: any) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        res.json({ success: true, files });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

const upload = multer({ dest: path.join(SERVER_DIR, 'plugins', '.temp') });

app.post('/api/server/files/upload', requireAuth, upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.json({ success: false, error: 'No file uploaded' });
        
        const relPath = req.body.path || req.body.basePath || 'plugins';
        const targetDir = path.resolve(SERVER_DIR, relPath.replace(/^\//, ''));
        if (!targetDir.startsWith(path.resolve(SERVER_DIR))) {
            return res.json({ success: false, error: 'Invalid path' });
        }
        
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        const targetPath = path.join(targetDir, req.file.originalname);
        fs.copyFileSync(req.file.path, targetPath);
        try { fs.unlinkSync(req.file.path); } catch (e) {}
        
        res.json({ success: true, file: req.file.originalname });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/files/delete', requireAuth, (req, res) => {
    try {
        const { files, basePath } = req.body;
        const targetDir = basePath ? path.resolve(SERVER_DIR, basePath.replace(/^\//, '')) : SERVER_DIR;
        
        if (!targetDir.startsWith(path.resolve(SERVER_DIR))) {
            return res.json({ success: false, error: 'Invalid path' });
        }

        for (const file of files) {
            const p = path.join(targetDir, file);
            if (fs.existsSync(p)) {
                const s = fs.statSync(p);
                if (s.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
                else fs.unlinkSync(p);
            }
        }
        res.json({ success: true });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/files/folder', requireAuth, (req, res) => {
    try {
        const { name, basePath } = req.body;
        const targetDir = basePath ? path.resolve(SERVER_DIR, basePath.replace(/^\//, '')) : SERVER_DIR;
        
        if (!targetDir.startsWith(path.resolve(SERVER_DIR))) {
            return res.json({ success: false, error: 'Invalid path' });
        }

        const p = path.join(targetDir, name);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        res.json({ success: true });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/files/file', requireAuth, (req, res) => {
    try {
        const { name, basePath } = req.body;
        const targetDir = basePath ? path.resolve(SERVER_DIR, basePath.replace(/^\//, '')) : SERVER_DIR;
        
        if (!targetDir.startsWith(path.resolve(SERVER_DIR))) {
            return res.json({ success: false, error: 'Invalid path' });
        }

        const p = path.join(targetDir, name);
        if (!fs.existsSync(p)) fs.writeFileSync(p, '');
        res.json({ success: true });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.get('/api/server/backups', requireAuth, (req, res) => {
    const backupDir = path.join(SERVER_DIR, 'backups');
    if (!fs.existsSync(backupDir)) return res.json({ success: true, backups: [] });
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.zip')).map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stats.size, date: stats.mtime };
    });
    res.json({ success: true, backups: files });
});

app.post('/api/server/backups/create', requireAuth, async (req, res) => {
    const backupDir = path.join(SERVER_DIR, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.zip`);
    
    sendCommand('save-all');
    setTimeout(() => {
        sendCommand('save-off');
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        const output = fs.createWriteStream(backupPath);
        
        output.on('close', () => {
            sendCommand('save-on');
            res.json({ success: true, file: `backup-${timestamp}.zip` });
        });
        
        archive.on('error', (err) => {
            sendCommand('save-on');
            res.json({ success: false, error: err.message });
        });
        
        archive.pipe(output);
        
        const dirs = ['world', 'world_nether', 'world_the_end', 'plugins'];
        for (const d of dirs) {
            const p = path.join(SERVER_DIR, d);
            if (fs.existsSync(p)) archive.glob('**/*', { cwd: p, ignore: ['**/session.lock'] }, { prefix: d });
        }
        
        const files = ['server.properties', 'banned-ips.json', 'banned-players.json', 'ops.json', 'whitelist.json'];
        for (const f of files) {
            const p = path.join(SERVER_DIR, f);
            if (fs.existsSync(p)) archive.file(p, { name: f });
        }
        
        archive.finalize();
    }, 2000);
});

app.delete('/api/server/backups/:filename', requireAuth, (req, res) => {
    try {
        const filename = req.params.filename;
        const backupPath = path.join(SERVER_DIR, 'backups', filename);
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'File not found' });
        }
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/backups/:filename/restore', requireAuth, async (req, res) => {
    try {
        const filename = req.params.filename;
        const backupPath = path.join(SERVER_DIR, 'backups', filename);
        if (!fs.existsSync(backupPath)) {
            return res.json({ success: false, error: 'Backup file not found' });
        }

        const wasOnline = getStatus() === 'online';
        if (wasOnline) {
            serverEvents.emit('console', '\n[System] Stopping server for backup restoration...\n');
            stopServer();
            // Wait briefly for process to die
            await new Promise(r => setTimeout(r, 2000));
        }

        serverEvents.emit('console', '[System] Extracting backup...\n');
        const zip = new AdmZip(backupPath);
        
        // Extract everything back to SERVER_DIR, overwriting existing files
        zip.extractAllTo(SERVER_DIR, true);

        if (wasOnline) {
            serverEvents.emit('console', '[System] Restoration complete. Restarting server...\n');
            await restartServer();
        } else {
            serverEvents.emit('console', '[System] Restoration complete.\n');
        }

        res.json({ success: true });
    } catch (e: any) {
        serverEvents.emit('console', `\n[System Error] Restoration failed: ${e.toString()}\n`);
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/players/:type', requireAuth, (req, res) => {
    const type = req.params.type;
    const { action, name } = req.body; // action: 'add' | 'remove'
    
    // For MVP, we will just use the server command console to manage players 
    // because Minecraft requires UUID computation for JSON files which is complex.
    if (action === 'add') {
        if (type === 'whitelist') sendCommand(`whitelist add ${name}`);
        if (type === 'ops') sendCommand(`op ${name}`);
        if (type === 'banned-players') sendCommand(`ban ${name}`);
    } else if (action === 'remove') {
        if (type === 'whitelist') sendCommand(`whitelist remove ${name}`);
        if (type === 'ops') sendCommand(`deop ${name}`);
        if (type === 'banned-players') sendCommand(`pardon ${name}`);
    }
    res.json({ success: true, message: 'Command queued. Server must be online for changes to apply immediately.' });
});

app.get('/api/server/log', requireAuth, (req, res) => {
    const logPath = path.join(SERVER_DIR, 'logs', 'latest.log');
    if (fs.existsSync(logPath)) {
        res.json({ success: true, content: fs.readFileSync(logPath, 'utf-8') });
    } else {
        res.json({ success: false, error: 'No logs found' });
    }
});

app.post('/api/server/log/clear', requireAuth, (req, res) => {
    const logPath = path.join(SERVER_DIR, 'logs', 'latest.log');
    if (fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '');
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'No logs found' });
    }
});

// Worlds API Endpoints & Persistent Registry
const CUSTOM_WORLDS_FILE = path.join(SERVER_DIR, 'custom_worlds_registry.json');

const getCustomWorldsRegistry = (): any[] => {
    try {
        if (fs.existsSync(CUSTOM_WORLDS_FILE)) {
            return JSON.parse(fs.readFileSync(CUSTOM_WORLDS_FILE, 'utf-8'));
        }
    } catch (e) {}
    return [];
};

const saveCustomWorldsRegistry = (list: any[]) => {
    try {
        fs.writeFileSync(CUSTOM_WORLDS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {}
};

app.get('/api/server/worlds', requireAuth, (req, res) => {
    try {
        const defaultWorlds = ['world', 'world_nether', 'world_the_end'];
        const registeredWorlds = getCustomWorldsRegistry();
        const registeredNames = registeredWorlds.map(w => w.name);

        const allDirs = fs.readdirSync(SERVER_DIR).filter(f => {
            const p = path.join(SERVER_DIR, f);
            return fs.statSync(p).isDirectory() && (
                fs.existsSync(path.join(p, 'level.dat')) || 
                fs.existsSync(path.join(p, 'world_manifest.json')) ||
                defaultWorlds.includes(f) ||
                registeredNames.includes(f)
            );
        });

        const list = allDirs.map(w => {
            const isDef = defaultWorlds.includes(w);
            const regItem = registeredWorlds.find(r => r.name === w);
            let env = regItem ? regItem.environment : 'normal';
            if (w.includes('nether')) env = 'nether';
            if (w.includes('end')) env = 'the_end';
            return {
                name: w,
                type: isDef ? (w === 'world' ? 'Overworld' : w === 'world_nether' ? 'Nether' : 'The End') : 'Custom Dimension',
                environment: env,
                isDefault: isDef,
                exists: true,
                forceUpgrade: false,
                optimize: true
            };
        });
        res.json({ success: true, worlds: list });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/world/create', requireAuth, (req, res) => {
    try {
        const { name, environment, seed, isEventEngine } = req.body;
        if (!name) return res.json({ success: false, error: 'Dimension name required' });

        const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

        // Restrict manual dimension creation — dimensions can ONLY be created automatically during Special Arena Wars
        if (!isEventEngine && !cleanName.startsWith('arena_')) {
            return res.json({ 
                success: false, 
                error: 'Dimension creation is restricted! Custom dimensions are automatically provisioned by the Event Engine when Special Arena Wars are launched.' 
            });
        }

        // If directory exists on disk, use mv import; otherwise use mv create
        if (fs.existsSync(targetDir)) {
            sendCommand(`mv import ${cleanName} ${envFlag}`);
        } else {
            sendCommand(`mv create ${cleanName} ${envFlag} ${seed ? `-s ${seed}` : ''}`);
        }

        // Save to persistent registry file
        const reg = getCustomWorldsRegistry();
        if (!reg.some(w => w.name === cleanName)) {
            reg.push({ name: cleanName, environment: envFlag, created: new Date().toISOString() });
            saveCustomWorldsRegistry(reg);
        }

        // Auto-generate BlueMap map config for this custom world
        const bluemapMapsDir = path.join(SERVER_DIR, 'plugins', 'BlueMap', 'maps');
        if (fs.existsSync(bluemapMapsDir)) {
            const bmConfPath = path.join(bluemapMapsDir, `${cleanName}.conf`);
            if (!fs.existsSync(bmConfPath)) {
                const isNether = envFlag === 'nether';
                const isEnd = envFlag === 'the_end' || envFlag === 'end';
                const skyColor = isNether ? '"#290000"' : isEnd ? '"#080010"' : '"#7dabff"';
                const skyLight = (isNether || isEnd) ? 0 : 15;
                const ambientLight = isNether ? 0.6 : isEnd ? 0.3 : 0.1;

                const bmConf = `##                          ##
##         BlueMap          ##
##        Map-Config        ##
##                          ##

name: "${cleanName}"
world: "${cleanName}"
sorting: 100
sky-color: ${skyColor}
void-color: "#000000"
ambient-light: ${ambientLight}
world-sky-light: ${skyLight}
remove-caves-below-y: ${isNether ? -10000 : 55}
cave-detection-ocean-floor: ${isNether ? 10000 : -5}
cave-detection-uses-block-light: false
min-inhabited-time: 0
render-edges: true
save-hires-layer: true
storage: "file"
ignore-missing-light-data: false
marker-sets: {}
`;
                fs.writeFileSync(bmConfPath, bmConf, 'utf-8');
            }
        }

        // Queue server creation command via Multiverse
        sendCommand(`mv create ${cleanName} ${envFlag} ${seed ? `-s ${seed}` : ''}`);

        // Reload BlueMap to pick up the new world config after a delay
        setTimeout(() => {
            sendCommand('bluemap reload');
        }, 5000);
        
        res.json({ success: true, message: `Custom dimension '${cleanName}' created successfully!`, name: cleanName });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/world/teleport', requireAuth, (req, res) => {
    try {
        const { player, dimension, x = 0, y = 100, z = 0 } = req.body;
        if (!player || !dimension) return res.json({ success: false, error: 'Player and Dimension required' });

        // Resolve to Multiverse world name (NOT minecraft: prefixed)
        let mvWorld = (dimension || 'world').replace('minecraft:', '');
        if (mvWorld === 'overworld') mvWorld = 'world';
        else if (mvWorld === 'the_nether' || mvWorld === 'nether') mvWorld = 'world_nether';
        else if (mvWorld === 'the_end' || mvWorld === 'end') mvWorld = 'world_the_end';

        // Multiverse tp first (moves player to the world), then coordinate tp after delay
        sendCommand(`mv tp ${player} ${mvWorld}`);
        setTimeout(() => {
            sendCommand(`tp ${player} ${x} ${y} ${z}`);
        }, 1000);

        res.json({ success: true, message: `Teleported ${player} to ${mvWorld} at ${x} ${y} ${z}` });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/world/delete', requireAuth, (req, res) => {
    try {
        const { name } = req.body;
        if (!name || ['world', 'world_nether', 'world_the_end'].includes(name)) {
            return res.json({ success: false, error: 'Cannot delete default server dimensions!' });
        }

        const targetDir = path.join(SERVER_DIR, name);
        sendCommand(`mv delete ${name}`);
        sendCommand(`mv confirm`);

        // Remove from persistent registry file
        const reg = getCustomWorldsRegistry().filter(w => w.name !== name);
        saveCustomWorldsRegistry(reg);

        if (fs.existsSync(targetDir)) {
            try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (err) {}
        }

        res.json({ success: true, message: `Dimension '${name}' deleted.` });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/world/gamerule', requireAuth, (req, res) => {
    try {
        const { rule, value } = req.body;
        if (rule && value !== undefined) {
            sendCommand(`gamerule ${rule} ${value}`);
            res.json({ success: true, message: `Gamerule ${rule} set to ${value}` });
        } else {
            res.json({ success: false, error: 'Invalid parameters' });
        }
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/world/action', requireAuth, (req, res) => {
    try {
        const { world, action, args } = req.body;
        if (action === 'difficulty') {
            sendCommand(`difficulty ${args.difficulty}`);
        }
        res.json({ success: true, message: `Action ${action} executed` });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

// Event Management Engine Database Persistence
async function getActiveEventFromDB() {
    try {
        const db = getDB();
        const row = await db.get(`SELECT * FROM active_event LIMIT 1`);
        if (!row) return null;
        return {
            id: row.id,
            title: row.title,
            mode: row.mode,
            arenaEnv: row.arena_env,
            dimension: row.dimension,
            startTime: row.start_time,
            teams: row.teams_json ? JSON.parse(row.teams_json) : [],
            players: row.players_json ? JSON.parse(row.players_json) : [],
            status: row.status
        };
    } catch (e) {
        return null;
    }
}

async function getEventHistoryFromDB() {
    try {
        const db = getDB();
        const rows = await db.all(`SELECT * FROM event_history ORDER BY timestamp DESC LIMIT 50`);
        return rows.map(r => ({
            id: r.id,
            title: r.title,
            mode: r.mode,
            winner: r.winner,
            date: r.date,
            arena: r.arena
        }));
    } catch (e) {
        return [];
    }
}

async function saveActiveEventToDB(event: any) {
    try {
        const db = getDB();
        await db.run(`DELETE FROM active_event`);
        if (event) {
            await db.run(
                `INSERT INTO active_event (id, title, mode, arena_env, dimension, start_time, teams_json, players_json, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    event.id,
                    event.title,
                    event.mode,
                    event.arenaEnv,
                    event.dimension,
                    event.startTime,
                    JSON.stringify(event.teams || []),
                    JSON.stringify(event.players || []),
                    event.status || 'ACTIVE'
                ]
            );
        }
    } catch (e) {}
}

async function recordEventHistoryToDB(historyItem: any) {
    try {
        const db = getDB();
        await db.run(
            `INSERT INTO event_history (id, title, mode, winner, date, arena, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                historyItem.id,
                historyItem.title,
                historyItem.mode,
                historyItem.winner,
                historyItem.date,
                historyItem.arena,
                Date.now()
            ]
        );
    } catch (e) {}
}

app.get('/api/server/events/status', requireAuth, async (req, res) => {
    const activeEvent = await getActiveEventFromDB();
    const history = await getEventHistoryFromDB();
    res.json({ success: true, activeEvent, history });
});

app.post('/api/server/events/start', requireAuth, async (req, res) => {
    try {
        const { title, mode, arenaEnv = 'normal', teams = [], players = [] } = req.body;
        if (!title) return res.json({ success: false, error: 'Event title required' });

        const eventId = `event_${Date.now().toString().slice(-6)}`;
        const dimensionName = `arena_${eventId}`;

        let mvEnv = 'NORMAL';
        if (arenaEnv === 'flat') {
            mvEnv = 'NORMAL -t FLAT';
        } else if (arenaEnv === 'nether') {
            mvEnv = 'NETHER';
        } else if (arenaEnv === 'the_end' || arenaEnv === 'end') {
            mvEnv = 'END';
        }

        // Provision disposable arena dimension via Multiverse
        sendCommand(`mv create ${dimensionName} ${mvEnv}`);

        // Set up Minecraft teams & disable friendly fire
        if (Array.isArray(teams) && teams.length > 0) {
            teams.forEach((t: any) => {
                const teamId = (t.name || 'team').toLowerCase().replace(/[^a-z0-9]/g, '_');
                sendCommand(`team add ${teamId}`);
                sendCommand(`team modify ${teamId} friendlyFire false`);
                sendCommand(`team modify ${teamId} color ${t.color || 'blue'}`);
                if (Array.isArray(t.members)) {
                    t.members.forEach((m: string) => sendCommand(`team join ${teamId} ${m}`));
                }
            });
        }

        // Broadcast match start
        sendCommand(`title @a title {"text":"⚔️ EVENT STARTED","color":"gold","bold":true}`);
        sendCommand(`title @a subtitle {"text":"${title}","color":"yellow"}`);
        sendCommand(`say [EVENT ENGINE] Match '${title}' (${mode}) starting! Generating arena... Teleporting in 6s!`);

        // Teleport participants using Multiverse directly to the arena's spawn point after creation delay (6.5s)
        setTimeout(() => {
            if (!Array.isArray(players) || players.length === 0) {
                sendCommand(`mv tp @a ${dimensionName}`);
            } else {
                players.forEach((p: string) => {
                    sendCommand(`mv tp ${p} ${dimensionName}`);
                });
            }
        }, 6500);

        const currentActiveEvent = {
            id: eventId,
            title,
            mode,
            arenaEnv,
            dimension: dimensionName,
            startTime: new Date().toLocaleTimeString(),
            teams,
            players,
            status: 'ACTIVE'
        };

        // Persist active event directly to SQLite Database
        await saveActiveEventToDB(currentActiveEvent);

        res.json({ success: true, message: `Event '${title}' started! Arena dimension '${dimensionName}' created.`, activeEvent: currentActiveEvent });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/events/announce', requireAuth, (req, res) => {
    try {
        const { message, title, subtitle } = req.body;
        if (title) {
            sendCommand(`title @a title {"text":"${title}","color":"gold","bold":true}`);
        }
        if (subtitle) {
            sendCommand(`title @a subtitle {"text":"${subtitle}","color":"yellow"}`);
        }
        if (message) {
            sendCommand(`say [EVENT ANNOUNCEMENT] ${message}`);
        }
        res.json({ success: true });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

app.post('/api/server/events/end', requireAuth, async (req, res) => {
    try {
        const { winnerName = 'Unknown', winnerType = 'Player' } = req.body;
        const currentActiveEvent = await getActiveEventFromDB();

        if (currentActiveEvent) {
            const dimName = currentActiveEvent.dimension;

            // Broadcast victory announcement
            sendCommand(`title @a title {"text":"🏆 VICTORY!","color":"gold","bold":true}`);
            sendCommand(`title @a subtitle {"text":"Winner: ${winnerName}","color":"green"}`);
            sendCommand(`say [EVENT ENGINE] Event '${currentActiveEvent.title}' finished! Winner: ${winnerName}`);

            // Teleport each participant back to their set bed / respawn anchor position (or world spawn as fallback)
            const onlineList = getOnlinePlayers();
            for (const pName of onlineList) {
                try {
                    const details = await getPlayerDetails(pName);
                    if (details && details.spawnPos && Array.isArray(details.spawnPos) && details.spawnPos.length === 3) {
                        const [sx, sy, sz] = details.spawnPos;
                        const sDim = (details.spawnDimension || 'world').replace('minecraft:', '');
                        sendCommand(`execute in ${sDim} run tp ${pName} ${sx} ${sy} ${sz}`);
                    } else {
                        sendCommand(`mv tp ${pName} world`);
                    }
                } catch (err) {
                    sendCommand(`mv tp ${pName} world`);
                }
            }

            // Clean up team scoreboards
            if (Array.isArray(currentActiveEvent.teams)) {
                currentActiveEvent.teams.forEach((t: any) => {
                    const teamId = (t.name || 'team').toLowerCase().replace(/[^a-z0-9]/g, '_');
                    sendCommand(`team remove ${teamId}`);
                });
            }

            // DESTROY / DELETE THE DISPOSABLE EVENT DIMENSION AUTOMATICALLY AFTER PLAYERS EVACUATE (3s delay)
            if (dimName && !['world', 'world_nether', 'world_the_end'].includes(dimName)) {
                const targetDir = path.join(SERVER_DIR, dimName);
                setTimeout(() => {
                    sendCommand(`mv unload ${dimName}`);
                    setTimeout(() => {
                        sendCommand(`mv delete ${dimName}`);
                        sendCommand(`mv confirm`);
                        setTimeout(() => {
                            if (fs.existsSync(targetDir)) {
                                try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (err) {}
                            }
                        }, 2000);
                    }, 1000);
                }, 3000);
            }

            // Save to SQLite DB history and clear active event
            await recordEventHistoryToDB({
                id: currentActiveEvent.id,
                title: currentActiveEvent.title,
                mode: currentActiveEvent.mode,
                winner: winnerName,
                date: new Date().toLocaleString(),
                arena: dimName
            });
            await saveActiveEventToDB(null);
        }

        res.json({ success: true, message: 'Event ended and arena dimension destroyed!' });
    } catch (e: any) {
        res.json({ success: false, error: e.toString() });
    }
});

// WebSocket for live console
wss.on('connection', async (ws, req) => {
    // Note: Simple auth for WS via query param ?token=...
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token || !activeTokens.has(token)) {
        ws.close(1008, 'Unauthorized');
        return;
    }

    const consoleListener = (data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'console', data }));
        }
    };
    
    const statusListener = (status: string) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'status', status }));
        }
    };

    // Send history immediately upon connection
    const history = getConsoleBuffer();
    history.forEach(line => {
        ws.send(JSON.stringify({ type: 'console', data: line }));
    });
    // Send current status
    ws.send(JSON.stringify({ type: 'status', status: await getStatus() }));

    serverEvents.on('console', consoleListener);
    serverEvents.on('status', statusListener);

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'command') {
                sendCommand(data.command);
            }
        } catch (e) {}
    });

    ws.on('close', () => {
        serverEvents.off('console', consoleListener);
        serverEvents.off('status', statusListener);
    });
});

// Broadcast usage stats
setInterval(async () => {
    const pid = getProcessPid();
    if (pid) {
        try {
            const stats = await pidusage(pid);
            const usage = {
                cpu: stats.cpu,
                memory: stats.memory
            };
            
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'usage', ...usage }));
                }
            });
        } catch (e) {
            // Process might have exited
        }
    }
}, 2000);

// Serve built frontend assets in production if frontend/dist exists
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (err) => {
            if (err) next();
        });
    });
}

const PORT = process.env.PORT || 3001;

initDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Backend API running on http://localhost:${PORT}`);
    });
}).catch(console.error);
