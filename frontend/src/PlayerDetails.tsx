import { useState, useEffect, useRef } from 'react';
import { Heart, Drumstick, Skull, Clock, Footprints, MapPin, XCircle, ShieldCheck, Users, Box, RefreshCw, Check, X, ArrowLeft, Gamepad2, ChevronDown, ChevronUp, UserX } from 'lucide-react';

const API_BASE = `${window.location.protocol}//${window.location.host}/api`;

function GamemodeDropdown({ playerName, isOnline, token }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState<string>('Creative');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const modes = ['Survival', 'Creative', 'Adventure', 'Spectator'];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (mode: string) => {
    setCurrentMode(mode);
    setIsOpen(false);
    if (!isOnline) {
      alert("Player must be online to change their gamemode live!");
      return;
    }
    await fetch(`${API_BASE}/server/command`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: `gamemode ${mode.toLowerCase()} ${playerName}` })
    });
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Closed Button Header matching Image 1 */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-[#f0f2f5] text-[#232931] px-3.5 py-1.5 rounded shadow-sm border border-gray-300 hover:bg-white transition-all font-semibold text-sm cursor-pointer select-none"
      >
        <Gamepad2 size={18} className="text-[#232931]" />
        <span>{currentMode}</span>
        {isOpen ? <ChevronUp size={16} className="text-[#232931]" /> : <ChevronDown size={16} className="text-[#232931]" />}
      </button>

      {/* Open Dropdown Menu matching Image 2 */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-white rounded-sm shadow-2xl border border-gray-300 z-[100] overflow-hidden divide-y divide-gray-200">
          <div className="flex items-center px-3 py-2 bg-gray-100 text-[#232931] font-semibold text-xs border-b border-gray-200 select-none">
            <Gamepad2 size={14} className="mr-1.5" /> Gamemode
          </div>
          {modes.map((mode) => {
            const isSelected = currentMode === mode;
            return (
              <button
                key={mode}
                onClick={() => handleSelect(mode)}
                className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected 
                    ? 'bg-blue-50 text-blue-900 border-l-4 border-blue-600 pl-3 font-semibold' 
                    : 'text-gray-800 hover:bg-gray-100 hover:text-black'
                }`}
              >
                <span>{mode}</span>
                {isSelected && <Check size={14} className="text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PlayerDetails({ token, playerName, isOnline, onBack }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isOp, setIsOp] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

  const [showTpModal, setShowTpModal] = useState(false);
  const [tpPos, setTpPos] = useState({ x: 0, y: 0, z: 0, dim: 'world' });
  const [availableWorlds, setAvailableWorlds] = useState<string[]>(['world', 'world_nether', 'world_the_end']);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/server/player/details/${playerName}`, { headers: { 'Authorization': `Bearer ${token}` }});
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setData(json.details);
      if (json.details.pos) {
        // Normalize minecraft: dimension IDs to Multiverse world names
        let dimName = json.details.dimension || 'world';
        dimName = dimName.replace('minecraft:', '');
        if (dimName === 'overworld') dimName = 'world';
        else if (dimName === 'the_nether') dimName = 'world_nether';
        else if (dimName === 'the_end') dimName = 'world_the_end';
        const match = availableWorlds.find(w => w.toLowerCase() === dimName.toLowerCase());
        if (match) dimName = match;
        setTpPos({ x: json.details.pos[0].toFixed(2), y: json.details.pos[1].toFixed(2), z: json.details.pos[2].toFixed(2), dim: dimName });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableWorlds = () => {
     let stored: string[] = [];
     try {
       const storedWorlds = localStorage.getItem('minepanel_custom_worlds');
       if (storedWorlds) {
         stored = JSON.parse(storedWorlds).map((w: any) => w.name);
       }
     } catch (e) {}

     fetch(`${API_BASE}/server/worlds`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(wData => {
          if (wData.success && Array.isArray(wData.worlds)) {
            const serverWorlds = wData.worlds.map((w: any) => w.name);
            const merged = Array.from(new Set([...serverWorlds, ...stored]));
            setAvailableWorlds(merged);
          } else if (stored.length > 0) {
            setAvailableWorlds(Array.from(new Set(['world', 'world_nether', 'world_the_end', ...stored])));
          }
        }).catch(() => {
          if (stored.length > 0) {
            setAvailableWorlds(Array.from(new Set(['world', 'world_nether', 'world_the_end', ...stored])));
          }
        });
  };

  const loadToggles = async () => {
     try {
       const [ops, wl, bans] = await Promise.all([
         fetch(`${API_BASE}/server/players/ops`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
         fetch(`${API_BASE}/server/players/whitelist`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
         fetch(`${API_BASE}/server/players/banned-players`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
       ]);
       const lowerName = playerName.toLowerCase();
       setIsOp(ops.players?.some((p:any) => p.name?.toLowerCase() === lowerName) || false);
       setIsWhitelisted(wl.players?.some((p:any) => p.name?.toLowerCase() === lowerName) || false);
       setIsBanned(bans.players?.some((p:any) => p.name?.toLowerCase() === lowerName) || false);
     } catch (e) {}
  };

  useEffect(() => {
    loadData();
    loadToggles();
    loadAvailableWorlds();
  }, [playerName]);

  useEffect(() => {
    if (showTpModal) {
      loadAvailableWorlds();
    }
  }, [showTpModal]);

  const [animatingHearts, setAnimatingHearts] = useState<'heal' | 'kill' | null>(null);
  const [animatingFood, setAnimatingFood] = useState<'feed' | 'starve' | null>(null);
  const [isSettingXp, setIsSettingXp] = useState(false);

  const handleXpAction = async (actionFn: () => Promise<void>) => {
    setIsSettingXp(true);
    try {
      await actionFn();
    } catch (e) {}
    setTimeout(() => {
      setIsSettingXp(false);
    }, 500);
  };

  const triggerAction = async (actionFn: () => Promise<void>, animType?: 'heal' | 'kill' | 'feed' | 'starve') => {
    if (animType === 'heal' || animType === 'kill') setAnimatingHearts(animType);
    if (animType === 'feed' || animType === 'starve') setAnimatingFood(animType);

    try {
      await actionFn();
    } catch (e) {}

    setTimeout(() => {
      setAnimatingHearts(null);
      setAnimatingFood(null);
    }, 600);
  };

  const sendAction = async (action: string, args?: any) => {
    if (!isOnline) {
      alert("Player must be online to execute this action safely!");
      return;
    }
    await fetch(`${API_BASE}/server/player/action`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName, action, args })
    });
    setTimeout(loadData, 500);
  };

  const toggleList = async (list: string, current: boolean) => {
    if (list === 'ops') setIsOp(!current);
    if (list === 'whitelist') setIsWhitelisted(!current);
    if (list === 'banned-players') setIsBanned(!current);

    try {
      await fetch(`${API_BASE}/server/players/${list}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: current ? 'remove' : 'add', name: playerName })
      });
    } catch (e) {}
    setTimeout(loadToggles, 600);
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[75vh] w-full my-auto">
        <div className="w-16 h-16 border-4 border-transparent border-t-emerald-400 border-r-emerald-400 rounded-full animate-spin drop-shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8 space-y-4 text-center bg-[#1c222b] border border-[#2d3847] rounded-sm shadow-xl max-w-lg mx-auto my-8">
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-full text-red-400">
          <UserX size={32} />
        </div>
        <h3 className="text-lg font-bold text-white tracking-wide">Failed to Load Player Data</h3>
        <p className="text-xs text-gray-400 font-mono bg-[#12161c] p-3 rounded border border-[#2d3847] max-w-md">
          {error}
        </p>
        <button onClick={onBack} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-sm shadow transition-colors cursor-pointer">
          ← Back to Players List
        </button>
      </div>
    );
  }

  const renderHearts = (amount: number) => {
    const full = animatingHearts === 'heal' ? 10 : animatingHearts === 'kill' ? 0 : Math.ceil(amount / 2);
    return Array.from({ length: 10 }).map((_, i) => {
      const isFilled = i < full;
      const isAnimating = animatingHearts !== null;
      return (
        <Heart 
          key={i} 
          size={20} 
          className={`transition-all duration-300 ${
            isAnimating && animatingHearts === 'heal'
              ? 'text-emerald-400 fill-emerald-400 animate-bounce scale-125 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]'
              : isAnimating && animatingHearts === 'kill'
              ? 'text-red-700 fill-red-950 animate-ping opacity-40 scale-75'
              : isFilled 
              ? 'text-red-500 fill-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' 
              : 'text-gray-700 fill-gray-800'
          }`} 
        />
      );
    });
  };

  const renderFood = (amount: number) => {
    const full = animatingFood === 'feed' ? 10 : animatingFood === 'starve' ? 0 : Math.ceil(amount / 2);
    return Array.from({ length: 10 }).map((_, i) => {
      const isFilled = i < full;
      const isAnimating = animatingFood !== null;
      return (
        <Drumstick 
          key={i} 
          size={20} 
          className={`transition-all duration-300 ${
            isAnimating && animatingFood === 'feed'
              ? 'text-amber-400 fill-amber-400 animate-bounce scale-125 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]'
              : isAnimating && animatingFood === 'starve'
              ? 'text-amber-950 fill-amber-950 animate-ping opacity-40 scale-75'
              : isFilled 
              ? 'text-amber-500 fill-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]' 
              : 'text-gray-700 fill-gray-800'
          }`} 
        />
      );
    });
  };

  // Convert inventory array to a map for easy lookup
  const invMap = new Map();
  (data?.inventory || []).forEach((item: any) => {
    invMap.set(item.Slot, item);
  });

  const renderSlot = (slotIdx: number) => {
    const item = invMap.get(slotIdx);
    const rawId = item ? item.id.replace('minecraft:', '') : '';
    const itemName = rawId.replace(/_/g, ' ');
    
    return (
      <div key={slotIdx} className="w-9 h-9 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-b-white border-r-white relative flex items-center justify-center group cursor-pointer">
        {item && (
           <>
             <img 
                src={`/assets/items/${rawId}.png`} 
                alt={itemName}
                onError={(e) => {
                  const target = e.currentTarget;
                  const currentSrc = target.src;
                  
                  if (currentSrc.includes('/assets/items/')) {
                      target.src = `/assets/blocks/${rawId}.png`;
                  } else if (currentSrc.includes(`/assets/blocks/${rawId}.png`)) {
                      let fallbackId = rawId;
                      if (fallbackId.includes('_stairs') || fallbackId.includes('_slab') || fallbackId.includes('_fence') || fallbackId.includes('_door') || fallbackId.includes('_sign') || fallbackId.includes('_boat')) {
                          fallbackId = fallbackId.replace(/_(stairs|slab|fence|door|sign|boat)$/, '_planks');
                          if (fallbackId === 'cobblestone_planks' || fallbackId === 'stone_planks') fallbackId = fallbackId.replace('_planks', '');
                          if (fallbackId.includes('wood_planks')) fallbackId = fallbackId.replace('wood_planks', 'planks');
                          target.src = `/assets/blocks/${fallbackId}.png`;
                      } else if (fallbackId.includes('_wall')) {
                          target.src = `/assets/blocks/${fallbackId.replace('_wall', '')}.png`;
                      } else {
                          target.style.display = 'none';
                          if (target.nextElementSibling) target.nextElementSibling.classList.remove('hidden');
                      }
                  } else {
                      target.style.display = 'none';
                      if (target.nextElementSibling) target.nextElementSibling.classList.remove('hidden');
                  }
                }}
                className="w-7 h-7 [image-rendering:pixelated] drop-shadow-sm" 
             />
             <Box size={18} className="text-[#3e3e4a] hidden" />
           </>
        )}
        {item && item.count > 1 && <span className="absolute bottom-0 right-0 text-[9px] font-bold text-white shadow-black drop-shadow-md pr-1">{item.count}</span>}
        
        {item && (
           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 bg-black text-white text-[11px] font-bold px-2 py-0.5 rounded whitespace-nowrap shadow-xl pointer-events-none capitalize">
              {itemName} {item.count > 1 ? `x${item.count}` : ''}
           </div>
        )}
      </div>
    );
  };

  // NBT Stats Parsing
  const getStat = (cat: string, name: string) => data?.stats?.stats?.[cat]?.[name] || 0;
  const playtimeTicks = getStat('minecraft:custom', 'minecraft:play_time');
  const playtimeMins = Math.floor(playtimeTicks / 20 / 60);

  const totalCm = 
    getStat('minecraft:custom', 'minecraft:walk_one_cm') +
    getStat('minecraft:custom', 'minecraft:sprint_one_cm') +
    getStat('minecraft:custom', 'minecraft:crouch_one_cm') +
    getStat('minecraft:custom', 'minecraft:swim_one_cm') +
    getStat('minecraft:custom', 'minecraft:fly_one_cm') +
    getStat('minecraft:custom', 'minecraft:aviate_one_cm') +
    getStat('minecraft:custom', 'minecraft:horse_one_cm') +
    getStat('minecraft:custom', 'minecraft:boat_one_cm') +
    getStat('minecraft:custom', 'minecraft:minecart_one_cm') +
    getStat('minecraft:custom', 'minecraft:fall_one_cm');
  const totalBlocks = Math.floor(totalCm / 100);

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto w-full pb-2">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
         <button 
           onClick={onBack} 
           className="px-3 py-1.5 bg-[#1c222b] hover:bg-[#28313e] border border-[#2d3847] rounded-sm text-gray-300 hover:text-white font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
         >
            <ArrowLeft size={15} />
            <span>Back</span>
         </button>
         <button 
           onClick={loadData} 
           className="bg-[#2196f3] hover:bg-blue-400 text-white px-3.5 py-1.5 rounded-sm flex items-center text-xs font-bold shadow transition-colors cursor-pointer"
         >
           <RefreshCw size={13} className="mr-1.5" />
           <span>Refresh</span>
         </button>
      </div>

      {/* Main Player Info Card with z-50 for dropdown visibility */}
      <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm shadow-xl relative z-50">
         <div className="p-2.5 flex items-center justify-between border-b border-[#2d3847] bg-[#181d24]">
            <div className="flex items-center space-x-3">
               <img src={`https://minotar.net/helm/${playerName}/40.png`} alt={playerName} className="w-10 h-10 rounded shadow border border-[#2d3847]" />
               <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-white text-lg tracking-wide">{playerName}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${isOnline ? 'bg-[#00c853]' : 'bg-gray-600'}`}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="text-gray-400 text-[11px] font-mono mt-0.5">{data?.uuid || 'Unknown UUID'}</div>
               </div>
            </div>
            
            <div className="flex items-center space-x-2.5">
               <GamemodeDropdown playerName={playerName} isOnline={isOnline} token={token} />
               {isOnline && (
                 <button 
                   onClick={() => sendAction('kill')} 
                   className="bg-[#ff2d55] hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-sm text-xs font-extrabold flex items-center shadow transition-colors cursor-pointer"
                 >
                   <span>Kick</span>
                 </button>
               )}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
         {/* Main Column (Health, Experience & Inventory) */}
         <div className="md:col-span-2 flex flex-col space-y-2.5">
            
            {/* Health & Experience Card */}
            <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm overflow-hidden shadow-xl">
               <div className="bg-[#181d24] text-white text-[11px] font-mono uppercase tracking-widest font-extrabold px-3 py-2 border-b border-[#2d3847] flex items-center justify-between">
                  <span>Health and experience</span>
                  <span className="text-emerald-400 font-bold">Level {data?.xpLevel || 0}</span>
               </div>
               
               <div className="p-3 space-y-2 bg-[#12161c]">
                  {/* XP Level Controls */}
                  <div className="flex items-center justify-between bg-[#1c222b] px-3 py-2 rounded border border-[#2d3847]">
                     <div className="flex items-center space-x-2">
                        <span className="text-white font-bold text-xs font-mono">XP Level {data?.xpLevel || 0}</span>
                        {isSettingXp && (
                          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold animate-pulse">
                            <div className="w-3 h-3 border-2 border-transparent border-t-emerald-400 border-r-emerald-400 rounded-full animate-spin"></div>
                            <span>Updating...</span>
                          </div>
                        )}
                     </div>
                     <div className="flex space-x-1.5">
                        <button 
                          onClick={() => handleXpAction(() => sendAction('removeLevel'))} 
                          className="bg-[#2d3847] hover:bg-[#3b495c] text-white px-2.5 py-0.5 rounded text-xs font-mono font-bold flex items-center cursor-pointer"
                        >
                          -1
                        </button>
                        <button 
                          onClick={() => {
                             const l = prompt('Set level to:');
                             if (l && !isNaN(parseInt(l))) handleXpAction(() => sendAction('setLevel', { level: parseInt(l) }));
                          }} 
                          className="bg-[#2d3847] hover:bg-[#3b495c] text-white px-2.5 py-0.5 rounded text-xs font-mono font-bold flex items-center cursor-pointer"
                        >
                          Set
                        </button>
                        <button 
                          onClick={() => handleXpAction(() => sendAction('addLevel'))} 
                          className="bg-[#2d3847] hover:bg-[#3b495c] text-white px-2.5 py-0.5 rounded text-xs font-mono font-bold flex items-center cursor-pointer"
                        >
                          +1
                        </button>
                     </div>
                  </div>
                  
                  {/* Health Row */}
                  <div className="flex items-center justify-between bg-[#1c222b] px-3 py-1.5 rounded border border-[#2d3847]">
                     <button 
                       onClick={() => triggerAction(() => sendAction('kill'), 'kill')} 
                       className="bg-[#ff2d55] hover:bg-rose-600 text-white text-xs font-bold py-1 px-4 rounded-sm shadow flex items-center justify-center w-24 cursor-pointer"
                     >
                       <Skull size={13} className="mr-1" /> Kill
                     </button>
                     <div className="flex space-x-1 overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 items-center">{renderHearts(data?.health || 0)}</div>
                     <button 
                       onClick={() => triggerAction(() => sendAction('heal'), 'heal')} 
                       className="bg-[#00c853] hover:bg-emerald-400 text-white text-xs font-bold py-1 px-4 rounded-sm shadow flex items-center justify-center w-24 cursor-pointer"
                     >
                       <Heart size={13} className="mr-1 fill-current" /> Heal
                     </button>
                  </div>
                  
                  {/* Food / Starvation Row */}
                  <div className="flex items-center justify-between bg-[#1c222b] px-3 py-1.5 rounded border border-[#2d3847]">
                     <button 
                       onClick={() => triggerAction(() => sendAction('starve'), 'starve')} 
                       className="bg-[#ff9800] hover:bg-amber-400 text-white text-xs font-bold py-1 px-4 rounded-sm shadow flex items-center justify-center w-24 cursor-pointer"
                     >
                       <Skull size={13} className="mr-1" /> Starve
                     </button>
                     <div className="flex space-x-1 overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 items-center">{renderFood(data?.foodLevel || 0)}</div>
                     <button 
                       onClick={() => triggerAction(() => sendAction('feed'), 'feed')} 
                       className="bg-[#00c853] hover:bg-emerald-400 text-white text-xs font-bold py-1 px-4 rounded-sm shadow flex items-center justify-center w-24 cursor-pointer"
                     >
                       <Drumstick size={13} className="mr-1 fill-current" /> Feed
                     </button>
                  </div>
               </div>
            </div>

            {/* Inventory Grid Card */}
            <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm overflow-hidden shadow-xl flex-1 flex flex-col">
               <div className="bg-[#181d24] text-white text-[11px] font-mono uppercase tracking-widest font-extrabold px-3 py-2 border-b border-[#2d3847]">
                  Inventory & Equipment
               </div>
               <div className="p-3 bg-[#12161c] flex flex-1 justify-between items-start gap-3">
                  <div className="flex flex-col space-y-1 bg-[#1c222b] p-2 rounded border border-[#2d3847]">
                     <div className="text-[9px] font-mono text-gray-400 uppercase text-center mb-0.5">Armor</div>
                     {[103, 102, 101, 100].map(renderSlot)}
                     <div className="h-1"></div>
                     <div className="text-[9px] font-mono text-gray-400 uppercase text-center mb-0.5">Offhand</div>
                     {renderSlot(-106)}
                  </div>

                  <div className="flex flex-col justify-end space-y-2 bg-[#1c222b] p-2.5 rounded border border-[#2d3847]">
                     <div className="text-[9px] font-mono text-gray-400 uppercase">Main Inventory</div>
                     <div className="grid grid-cols-9 gap-1 border-2 border-[#2d3847] p-1 bg-[#12161c] rounded">
                        {Array.from({ length: 27 }).map((_, i) => renderSlot(i + 9))}
                     </div>
                     <div className="text-[9px] font-mono text-gray-400 uppercase pt-0.5">Hotbar</div>
                     <div className="grid grid-cols-9 gap-1 border-2 border-emerald-500/30 p-1 bg-[#12161c] rounded">
                        {Array.from({ length: 9 }).map((_, i) => renderSlot(i))}
                     </div>
                  </div>
               </div>
            </div>

         </div>

         {/* Right Sidebar Controls & Stats */}
         <div className="space-y-2.5">
            {/* Player Permissions Toggle Card */}
            <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm overflow-hidden shadow-xl">
               <div className="bg-[#181d24] text-white text-[11px] font-mono uppercase tracking-widest font-extrabold px-3 py-2 border-b border-[#2d3847]">
                  Control & Permissions
               </div>
               <div className="p-2.5 space-y-2 bg-[#12161c]">
                  <div className="flex items-center justify-between bg-[#1c222b] p-2 rounded border border-[#2d3847]">
                     <div className="flex items-center text-xs font-bold text-gray-200"><ShieldCheck size={15} className="mr-1.5 text-amber-400" /> Whitelisted</div>
                     <div 
                        onClick={() => toggleList('whitelist', isWhitelisted)}
                        className="relative flex w-[44px] h-[22px] cursor-pointer bg-[#2d3847] overflow-hidden rounded-sm shadow-inner border border-[#3e3e4a]"
                     >
                        <div className={`absolute top-0 bottom-0 w-1/2 flex items-center justify-center shadow-lg transition-transform duration-300 ease-out ${isWhitelisted ? 'translate-x-full bg-[#00c853]' : 'translate-x-0 bg-[#ff2d55]'}`}>
                           {isWhitelisted ? <Check size={14} color="white" strokeWidth={3} /> : <X size={14} color="white" strokeWidth={3} />}
                        </div>
                      </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#1c222b] p-2 rounded border border-[#2d3847]">
                     <div className="flex items-center text-xs font-bold text-gray-200"><XCircle size={15} className="mr-1.5 text-red-400" /> Banned</div>
                     <div 
                        onClick={() => toggleList('banned-players', isBanned)}
                        className="relative flex w-[44px] h-[22px] cursor-pointer bg-[#2d3847] overflow-hidden rounded-sm shadow-inner border border-[#3e3e4a]"
                     >
                        <div className={`absolute top-0 bottom-0 w-1/2 flex items-center justify-center shadow-lg transition-transform duration-300 ease-out ${isBanned ? 'translate-x-full bg-[#00c853]' : 'translate-x-0 bg-[#ff2d55]'}`}>
                           {isBanned ? <Check size={14} color="white" strokeWidth={3} /> : <X size={14} color="white" strokeWidth={3} />}
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#1c222b] p-2 rounded border border-[#2d3847]">
                     <div className="flex items-center text-xs font-bold text-gray-200"><Users size={15} className="mr-1.5 text-purple-400" /> Operator</div>
                     <div 
                        onClick={() => toggleList('ops', isOp)}
                        className="relative flex w-[44px] h-[22px] cursor-pointer bg-[#2d3847] overflow-hidden rounded-sm shadow-inner border border-[#3e3e4a]"
                     >
                        <div className={`absolute top-0 bottom-0 w-1/2 flex items-center justify-center shadow-lg transition-transform duration-300 ease-out ${isOp ? 'translate-x-full bg-[#00c853]' : 'translate-x-0 bg-[#ff2d55]'}`}>
                           {isOp ? <Check size={14} color="white" strokeWidth={3} /> : <X size={14} color="white" strokeWidth={3} />}
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Position & Teleport Card */}
            <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm overflow-hidden shadow-xl">
               <div className="bg-[#181d24] text-white text-[11px] font-mono uppercase tracking-widest font-extrabold px-3 py-2 border-b border-[#2d3847]">
                  Position & Dimension
               </div>
               <div className="p-2.5 bg-[#12161c] space-y-2">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center text-white font-bold text-xs"><MapPin size={14} className="mr-1.5 text-blue-400" /> Current Position</div>
                     <button 
                       onClick={() => setShowTpModal(true)} 
                       className="bg-[#2196f3] hover:bg-blue-400 text-white text-[11px] font-bold py-0.5 px-2.5 rounded-sm shadow transition-colors flex items-center cursor-pointer"
                     >
                        <MapPin size={11} className="mr-1" /> Teleport
                     </button>
                  </div>
                  <div className="text-emerald-400 text-xs font-mono bg-[#1c222b] p-2 rounded border border-[#2d3847]">
                     X {data?.pos?.[0]?.toFixed(2) || 0} &nbsp;&nbsp; Y {data?.pos?.[1]?.toFixed(2) || 0} &nbsp;&nbsp; Z {data?.pos?.[2]?.toFixed(2) || 0}
                  </div>
                  <div className="text-gray-400 text-[11px] font-mono flex items-center">
                     Dimension: <span className="text-white ml-1 font-bold">{data?.dimension || 'minecraft:overworld'}</span>
                  </div>
               </div>
            </div>

            {/* Statistics Card */}
            <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm overflow-hidden shadow-xl">
               <div className="bg-[#181d24] text-white text-[11px] font-mono uppercase tracking-widest font-extrabold px-3 py-2 border-b border-[#2d3847]">
                  Player Statistics
               </div>
               <div className="p-2.5 space-y-1.5 bg-[#12161c]">
                  <div className="flex justify-between items-center border-b border-[#2d3847] pb-1.5">
                     <div className="flex items-center text-blue-400 font-bold text-xs"><Clock size={13} className="mr-1.5" /> Playtime</div>
                     <div className="text-white text-xs font-mono font-bold">{playtimeMins} min</div>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#2d3847] pb-1.5">
                     <div className="flex items-center text-emerald-400 font-bold text-xs"><Skull size={13} className="mr-1.5" /> Kills</div>
                     <div className="text-white text-xs font-mono font-bold">{getStat('minecraft:custom', 'minecraft:player_kills')}</div>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#2d3847] pb-1.5">
                     <div className="flex items-center text-red-400 font-bold text-xs"><Skull size={13} className="mr-1.5" /> Deaths</div>
                     <div className="text-white text-xs font-mono font-bold">{getStat('minecraft:custom', 'minecraft:deaths')}</div>
                  </div>
                  <div className="flex justify-between items-center">
                     <div className="flex items-center text-purple-400 font-bold text-xs"><Footprints size={13} className="mr-1.5" /> Distance</div>
                     <div className="text-white text-xs font-mono font-bold">{totalBlocks.toLocaleString()} blocks</div>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Teleport Modal */}
      {showTpModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1c222b] rounded-sm shadow-2xl border border-[#2d3847] w-full max-w-md overflow-hidden">
             <div className="bg-[#2196f3] text-white p-3 font-bold flex justify-between items-center select-none">
                <span className="text-sm tracking-wide">Teleport {playerName}</span>
                <button onClick={() => setShowTpModal(false)} className="text-white hover:text-gray-200 font-bold">✕</button>
             </div>
             
             <div className="p-4 bg-[#12161c] space-y-3 font-mono text-xs">
                {/* Target World Selector */}
                <div className="flex items-center bg-[#1c222b] border border-[#2d3847] rounded overflow-hidden">
                   <div className="bg-[#181d24] w-1/3 p-2 font-bold text-gray-300">Target World</div>
                   <select 
                     value={tpPos.dim} 
                     onChange={e => {
                       const selectedDim = e.target.value;
                       setTpPos(prev => ({
                         ...prev,
                         dim: selectedDim,
                         x: data?.pos ? parseFloat(data.pos[0].toFixed(2)) : 0,
                         y: data?.pos ? parseFloat(data.pos[1].toFixed(2)) : 100,
                         z: data?.pos ? parseFloat(data.pos[2].toFixed(2)) : 0
                       }));
                     }} 
                     className="w-2/3 p-2 outline-none bg-[#1c222b] text-emerald-400 font-bold font-mono cursor-pointer"
                   >
                     <option value="world">world (Overworld)</option>
                     <option value="world_nether">world_nether (Nether)</option>
                     <option value="world_the_end">world_the_end (The End)</option>
                     {availableWorlds
                        .filter((w: string) => !['world', 'world_nether', 'world_the_end'].includes(w.toLowerCase()))
                        .map((w: string) => (
                          <option key={w} value={w}>
                            {w} (Custom)
                          </option>
                        ))}
                   </select>
                </div>

                {/* Coordinates (Strictly Bound to Overworld 'world') */}
                {tpPos.dim === 'world' ? (
                  <>
                    <div className="text-[11px] text-gray-400 font-sans italic pt-1">
                      Overworld Target Location (X / Y / Z):
                    </div>
                    <div className="flex items-center bg-[#1c222b] border border-[#2d3847] rounded overflow-hidden">
                       <div className="bg-[#181d24] w-1/3 p-2 font-bold text-gray-300">X</div>
                       <input type="number" value={tpPos.x} onChange={e => setTpPos({...tpPos, x: parseFloat(e.target.value) || 0})} className="w-2/3 p-2 outline-none bg-transparent text-emerald-400 font-bold font-mono" />
                    </div>
                    <div className="flex items-center bg-[#1c222b] border border-[#2d3847] rounded overflow-hidden">
                       <div className="bg-[#181d24] w-1/3 p-2 font-bold text-gray-300">Y</div>
                       <input type="number" value={tpPos.y} onChange={e => setTpPos({...tpPos, y: parseFloat(e.target.value) || 0})} className="w-2/3 p-2 outline-none bg-transparent text-emerald-400 font-bold font-mono" />
                    </div>
                    <div className="flex items-center bg-[#1c222b] border border-[#2d3847] rounded overflow-hidden">
                       <div className="bg-[#181d24] w-1/3 p-2 font-bold text-gray-300">Z</div>
                       <input type="number" value={tpPos.z} onChange={e => setTpPos({...tpPos, z: parseFloat(e.target.value) || 0})} className="w-2/3 p-2 outline-none bg-transparent text-emerald-400 font-bold font-mono" />
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-[#1c222b] border border-[#2d3847] rounded text-gray-300 text-xs italic leading-relaxed">
                    ℹ️ Coordinates are bound to Overworld only. Teleports player directly to <strong>{tpPos.dim}</strong> spawn point via Multiverse.
                  </div>
                )}
             </div>
             
             <div className="bg-[#1c222b] p-3 border-t border-[#2d3847] flex justify-end space-x-2">
                <button onClick={() => setShowTpModal(false)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1.5 px-3 rounded-sm text-xs cursor-pointer">Cancel</button>
                {tpPos.dim === 'world' ? (
                  <button 
                    onClick={() => {
                      sendAction('teleport', { x: tpPos.x, y: tpPos.y, z: tpPos.z, dimension: 'world', toSpawn: false, useExactCoords: true });
                      setShowTpModal(false);
                    }} 
                    className="bg-[#00c853] hover:bg-emerald-400 text-white font-bold py-1.5 px-4 rounded-sm text-xs shadow cursor-pointer flex items-center"
                  >
                    <span>Teleport to Coords</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      sendAction('teleport', { dimension: tpPos.dim, toSpawn: true, useExactCoords: false });
                      setShowTpModal(false);
                    }} 
                    className="bg-[#2196f3] hover:bg-blue-400 text-white font-bold py-1.5 px-4 rounded-sm text-xs shadow cursor-pointer flex items-center"
                  >
                    <span>Warp to World Spawn</span>
                  </button>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
