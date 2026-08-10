import fs from 'fs';
import path from 'path';
import nbt from 'prismarine-nbt';
import { SERVER_DIR, getOnlinePlayers, sendCommand } from './serverManager';

export function getPlayerUUID(username: string): string | null {
    try {
        const cachePath = path.join(SERVER_DIR, 'usercache.json');
        if (!fs.existsSync(cachePath)) return null;
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        const user = cache.find((u: any) => u.name.toLowerCase() === username.toLowerCase());
        return user ? user.uuid : null;
    } catch (e) {
        return null;
    }
}

function simplifyNBT(tag: any): any {
    if (tag === null || tag === undefined) return null;
    if (typeof tag !== 'object') return tag;

    if (tag.type !== undefined && tag.value !== undefined) {
        if (tag.type === 'compound') {
            const result: any = {};
            for (const key in tag.value) {
                result[key] = simplifyNBT(tag.value[key]);
            }
            return result;
        }
        if (tag.type === 'list') {
            return tag.value.value.map(simplifyNBT);
        }
        return tag.value;
    }

    if (Array.isArray(tag)) {
        return tag.map(simplifyNBT);
    }

    const result: any = {};
    for (const key in tag) {
        result[key] = simplifyNBT(tag[key]);
    }
    return result;
}

export async function getPlayerDetails(username: string) {
    const uuid = getPlayerUUID(username);
    if (!uuid) throw new Error('Player not found in usercache');

    const isOnline = getOnlinePlayers().includes(username);
    if (isOnline) {
        sendCommand('save-all');
        // Wait 1000ms for data to be flushed to disk
        await new Promise(r => setTimeout(r, 1000));
    }

    const datPath = path.join(SERVER_DIR, 'world', 'playerdata', `${uuid}.dat`);
    if (!fs.existsSync(datPath)) throw new Error('No player data found');

    const buffer = fs.readFileSync(datPath);
    const { parsed } = await nbt.parse(buffer);
    const simple = simplifyNBT(parsed);

    let stats = {};
    const statsPath = path.join(SERVER_DIR, 'world', 'stats', `${uuid}.json`);
    if (fs.existsSync(statsPath)) {
        try {
            stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
        } catch (e) {}
    }

    return {
        uuid,
        health: simple.Health || 0,
        foodLevel: simple.foodLevel || 0,
        xpLevel: simple.XpLevel || 0,
        pos: simple.Pos || [0, 0, 0],
        dimension: simple.Dimension || 'minecraft:overworld',
        spawnPos: (simple.SpawnX !== undefined && simple.SpawnY !== undefined && simple.SpawnZ !== undefined) 
            ? [simple.SpawnX, simple.SpawnY, simple.SpawnZ] 
            : null,
        spawnDimension: simple.SpawnDimension ? simple.SpawnDimension.replace('minecraft:', '') : null,
        inventory: simple.Inventory || [],
        enderItems: simple.EnderItems || [],
        stats
    };
}
