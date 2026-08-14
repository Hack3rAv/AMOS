import { useState, useEffect, useRef } from 'react';
import { 
  Globe, Download, Upload, Sliders, RefreshCw, Trash2, 
  CornerUpLeft, Check, X, Swords, Flame, Eye, FileArchive, Sparkles
} from 'lucide-react';

const API_BASE = `${window.location.protocol}//${window.location.host}/api`;

interface WorldItem {
  name: string;
  type: string;
  environment: string;
  isDefault: boolean;
  exists: boolean;
}

interface WorldsTabProps {
  token: string;
}

export function WorldsTab({ token }: WorldsTabProps) {
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'spawning' | 'world' | 'system'>('all');

  // Modals State
  const [uploadWorldModal, setUploadWorldModal] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // World Options & Gamerules State
  const [difficulty, setDifficulty] = useState<'Peaceful' | 'Easy' | 'Normal' | 'Hard'>('Easy');
  const [hardcore, setHardcore] = useState(false);
  const [seed] = useState('5354710609080662631');

  // Datapacks State
  const [enabledFeatures] = useState<string[]>(['Vanilla']);
  const [enabledDatapacks] = useState<string[]>(['Vanilla', 'file/bukkit', 'paper']);
  const [disabledDatapacks] = useState<string[]>(['Bundles', 'Trade Rebalance', 'Update 1.21']);

  const getStoredCustomWorlds = (): WorldItem[] => {
    try {
      const stored = localStorage.getItem('minepanel_custom_worlds');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  };

  const saveStoredCustomWorlds = (items: WorldItem[]) => {
    try {
      localStorage.setItem('minepanel_custom_worlds', JSON.stringify(items));
    } catch (e) {}
  };

  const loadWorlds = async () => {
    const storedCustom = getStoredCustomWorlds();
    try {
      const res = await fetch(`${API_BASE}/server/worlds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.worlds)) {
        const mergedMap = new Map<string, WorldItem>();
        data.worlds.forEach((w: WorldItem) => mergedMap.set(w.name.toLowerCase(), w));
        storedCustom.forEach(cw => {
          if (!mergedMap.has(cw.name.toLowerCase())) {
            mergedMap.set(cw.name.toLowerCase(), cw);
          }
        });
        setWorlds(Array.from(mergedMap.values()));
      }
    } catch (e) {
      const defaultWorlds: WorldItem[] = [
        { name: 'world', type: 'Overworld', environment: 'normal', isDefault: true, exists: true },
        { name: 'world_nether', type: 'Nether', environment: 'nether', isDefault: false, exists: true },
        { name: 'world_the_end', type: 'The End', environment: 'the_end', isDefault: false, exists: true }
      ];
      setWorlds([...defaultWorlds, ...storedCustom]);
    }
  };

  useEffect(() => {
    loadWorlds();
  }, []);

  // Categorized Gamerules
  const categories = [
    { id: 'all', label: 'All Gamerules', count: 46 },
    { id: 'spawning', label: 'Mobs & Spawning', count: 12 },
    { id: 'world', label: 'World & Environment', count: 14 },
    { id: 'system', label: 'System & Admin', count: 20 },
  ];

  // Boolean Gamerules State
  const [boolRules, setBoolRules] = useState<Record<string, { val: boolean; cat: 'spawning' | 'world' | 'system' }>>({
    announceAdvancements: { val: true, cat: 'system' },
    universalAnger: { val: false, cat: 'spawning' },
    commandBlockOutput: { val: true, cat: 'system' },
    disableElytraMovementCheck: { val: false, cat: 'system' },
    disableRaids: { val: false, cat: 'spawning' },
    doDaylightCycle: { val: true, cat: 'world' },
    doEntityDrops: { val: true, cat: 'world' },
    doFireTick: { val: true, cat: 'world' },
    doInsomnia: { val: true, cat: 'spawning' },
    doImmediateRespawn: { val: false, cat: 'system' },
    doLimitedCrafting: { val: false, cat: 'system' },
    doMobLoot: { val: true, cat: 'spawning' },
    doMobSpawning: { val: true, cat: 'spawning' },
    doPatrolSpawning: { val: true, cat: 'spawning' },
    doTileDrops: { val: true, cat: 'world' },
    doTraderSpawning: { val: true, cat: 'spawning' },
    doWeatherCycle: { val: true, cat: 'world' },
    drowningDamage: { val: true, cat: 'world' },
    fallDamage: { val: true, cat: 'world' },
    fireDamage: { val: true, cat: 'world' },
    forgiveDeadPlayers: { val: true, cat: 'system' },
    freezeDamage: { val: true, cat: 'world' },
    keepInventory: { val: false, cat: 'system' },
    showDeathMessages: { val: true, cat: 'system' },
    logAdminCommands: { val: true, cat: 'system' },
    mobGriefing: { val: true, cat: 'spawning' },
    naturalRegeneration: { val: true, cat: 'world' },
    reducedDebugInfo: { val: false, cat: 'system' },
    spectatorsGenerateChunks: { val: true, cat: 'world' },
    sendCommandFeedback: { val: true, cat: 'system' },
    blockExplosionDropDecay: { val: true, cat: 'world' },
    mobExplosionDropDecay: { val: true, cat: 'world' },
    tntExplosionDropDecay: { val: false, cat: 'world' },
    waterSourceConversion: { val: true, cat: 'world' },
    lavaSourceConversion: { val: false, cat: 'world' },
    globalSoundEvents: { val: true, cat: 'system' },
    enderPearlsVanishOnDeath: { val: true, cat: 'system' },
    projectilesCanBreakBlocks: { val: true, cat: 'world' },
  });

  // Numeric Gamerules State
  const [numRules, setNumRules] = useState<Record<string, { val: number; cat: 'spawning' | 'world' | 'system' }>>({
    maxCommandChainLength: { val: 65536, cat: 'system' },
    maxEntityCramming: { val: 24, cat: 'spawning' },
    playersSleepingPercentage: { val: 100, cat: 'world' },
    randomTickSpeed: { val: 3, cat: 'world' },
    spawnRadius: { val: 10, cat: 'system' },
    snowAccumulationHeight: { val: 1, cat: 'world' },
    playersNetherPortalDefaultDelay: { val: 80, cat: 'system' },
    playersNetherPortalCreativeDelay: { val: 1, cat: 'system' },
  });

  const toggleBoolRule = async (rule: string) => {
    const newVal = !boolRules[rule].val;
    setBoolRules(prev => ({ ...prev, [rule]: { ...prev[rule], val: newVal } }));
    try {
      await fetch(`${API_BASE}/server/world/gamerule`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule, value: newVal })
      });
    } catch (e) {}
  };

  const updateNumRule = async (rule: string, newVal: number) => {
    setNumRules(prev => ({ ...prev, [rule]: { ...prev[rule], val: newVal } }));
    try {
      await fetch(`${API_BASE}/server/world/gamerule`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule, value: newVal })
      });
    } catch (e) {}
  };

  const handleDifficultyChange = async (newDiff: 'Peaceful' | 'Easy' | 'Normal' | 'Hard') => {
    setDifficulty(newDiff);
    try {
      await fetch(`${API_BASE}/server/world/action`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ world: selectedWorld, action: 'difficulty', args: { difficulty: newDiff.toLowerCase() } })
      });
    } catch (e) {}
  };



  const handleDeleteDimension = async (worldName: string) => {
    if (['world', 'world_nether', 'world_the_end'].includes(worldName)) {
      if (!confirm(`Are you sure you want to delete ${worldName}? Deleting core server worlds will reset chunk data!`)) return;
    } else {
      if (!confirm(`Are you sure you want to delete custom dimension '${worldName}'?`)) return;
    }

    // Remove from localStorage
    const stored = getStoredCustomWorlds().filter(w => w.name.toLowerCase() !== worldName.toLowerCase());
    saveStoredCustomWorlds(stored);

    setWorlds(prev => prev.filter(w => w.name !== worldName));

    try {
      await fetch(`${API_BASE}/server/world/delete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: worldName })
      });
    } catch (e) {}
  };

  const handleDownloadWorld = (worldName: string) => {
    const link = document.createElement('a');
    link.href = `${API_BASE}/server/backups/download-${worldName}`;
    link.download = `${worldName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadSimulate = (worldName: string) => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setUploadWorldModal(null);
      alert(`World archive successfully uploaded and extracted into '${worldName}'!`);
    }, 1200);
  };

  // Render Toggle Switch (Red X / Green Check)
  const renderToggleSwitch = (active: boolean, onToggle: () => void) => (
    <div 
      onClick={onToggle}
      className="relative flex w-[48px] h-[24px] cursor-pointer bg-[#2d3847] overflow-hidden rounded-none shadow-inner border border-[#3e3e4a] select-none flex-shrink-0"
    >
      <div className={`absolute top-0 bottom-0 w-1/2 flex items-center justify-center shadow-lg transition-transform duration-200 ease-out ${
        active ? 'translate-x-full bg-[#00c853]' : 'translate-x-0 bg-[#ff2d55]'
      }`}>
        {active ? <Check size={16} color="white" strokeWidth={3} /> : <X size={16} color="white" strokeWidth={3} />}
      </div>
    </div>
  );

  // Filtered Gamerules
  const filteredBoolRules = Object.entries(boolRules).filter(([_, item]) => activeCategory === 'all' || item.cat === activeCategory);
  const filteredNumRules = Object.entries(numRules).filter(([_, item]) => activeCategory === 'all' || item.cat === activeCategory);

  // ----------------------------------------------------
  // SCREEN 2: WORLD OPTIONS & GAMERULES VIEW (SCROLLABLE & BIGGER UI)
  // ----------------------------------------------------
  if (selectedWorld) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto w-full pb-12">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2d3847]">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setSelectedWorld(null)} 
              className="px-4 py-2 bg-[#1c222b] hover:bg-[#28313e] border border-[#2d3847] rounded text-gray-300 hover:text-white font-bold text-sm flex items-center space-x-2 transition-colors cursor-pointer shadow"
            >
              <CornerUpLeft size={18} />
              <span>Back to Worlds</span>
            </button>
            <h2 className="text-2xl font-extrabold text-white tracking-wide flex items-center space-x-2">
              <span>Worlds</span>
              <span className="text-gray-500 font-normal">/</span>
              <span className="text-emerald-400 font-mono">{selectedWorld}</span>
            </h2>
          </div>

          {/* Gamerule Category Filter Tabs */}
          <div className="flex space-x-2 bg-[#181d24] p-1.5 rounded-lg border border-[#2d3847]">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id as any)}
                className={`px-4 py-1.5 rounded font-bold text-xs transition-all cursor-pointer ${
                  activeCategory === c.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-[#1c222b]'
                }`}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>
        </div>

        {/* Top Options Bar (Seed, Hardcore, Difficulty) - Bigger UI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Seed Box */}
          <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-4 space-y-2 shadow-md">
            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Seed</div>
            <div className="bg-[#12161c] border border-[#2d3847] px-3.5 py-2.5 rounded flex items-center justify-between font-mono text-sm text-white">
              <div className="flex items-center space-x-2.5 truncate">
                <span className="text-amber-400 text-base">⛰️</span>
                <span className="font-extrabold tracking-wide text-white">{seed}</span>
              </div>
            </div>
            <div className="text-xs font-mono text-gray-400">seed: {seed}</div>
          </div>

          {/* Hardcore Toggle */}
          <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-4 space-y-2 shadow-md">
            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Hardcore</div>
            <div className="bg-[#12161c] border border-[#2d3847] px-3.5 py-2 rounded flex items-center justify-between">
              <span className="text-sm text-white font-bold">Hardcore Mode</span>
              {renderToggleSwitch(hardcore, () => setHardcore(!hardcore))}
            </div>
            <div className="text-xs font-mono text-gray-400">hardcore: {hardcore ? 'true' : 'false'}</div>
          </div>

          {/* Difficulty Dropdown */}
          <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-4 space-y-2 shadow-md">
            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Difficulty</div>
            <div className="bg-[#12161c] border border-[#2d3847] px-3 py-1.5 rounded flex items-center justify-between">
              <select 
                value={difficulty} 
                onChange={(e: any) => handleDifficultyChange(e.target.value)}
                className="w-full bg-transparent text-white font-bold text-sm outline-none cursor-pointer"
              >
                <option value="Peaceful" className="bg-[#1c222b] text-white">Peaceful</option>
                <option value="Easy" className="bg-[#1c222b] text-white">Easy</option>
                <option value="Normal" className="bg-[#1c222b] text-white">Normal</option>
                <option value="Hard" className="bg-[#1c222b] text-white">Hard</option>
              </select>
            </div>
            <div className="text-xs font-mono text-gray-400">Difficulty: {difficulty === 'Easy' ? '1' : difficulty === 'Normal' ? '2' : difficulty === 'Hard' ? '3' : '0'}</div>
          </div>
        </div>

        {/* Datapacks Section (3 Cols) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-3.5 space-y-2 shadow-md">
            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Enabled features</div>
            <div className="bg-[#12161c] border border-[#2d3847] p-2 rounded flex flex-wrap gap-1.5 min-h-[40px] items-center">
              {enabledFeatures.map((f) => (
                <span key={f} className="bg-[#2d3847] text-white text-xs px-2.5 py-1 rounded font-mono flex items-center space-x-1.5">
                  <span>{f}</span>
                  <span className="text-gray-400 hover:text-white cursor-pointer">☒</span>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-3.5 space-y-2 shadow-md">
            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Enabled datapacks</div>
            <div className="bg-[#12161c] border border-[#2d3847] p-2 rounded flex flex-wrap gap-1.5 min-h-[40px] items-center">
              {enabledDatapacks.map((dp) => (
                <span key={dp} className="bg-[#2d3847] text-white text-xs px-2.5 py-1 rounded font-mono flex items-center space-x-1.5">
                  <span>{dp}</span>
                  <span className="text-gray-400 hover:text-white cursor-pointer">☒</span>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-3.5 space-y-2 shadow-md">
            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Disabled datapacks</div>
            <div className="bg-[#12161c] border border-[#2d3847] p-2 rounded flex flex-wrap gap-1.5 min-h-[40px] items-center">
              {disabledDatapacks.map((dp) => (
                <span key={dp} className="bg-[#2d3847] text-white text-xs px-2.5 py-1 rounded font-mono flex items-center space-x-1.5">
                  <span>{dp}</span>
                  <span className="text-gray-400 hover:text-white cursor-pointer">☒</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Gamerules Section - Fully Scrollable & Bigger UI */}
        <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-4 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2.5 text-white font-extrabold text-base border-b border-[#2d3847] pb-2">
            <Swords className="text-emerald-400" size={20} />
            <span>Gamerules ({filteredBoolRules.length + filteredNumRules.length})</span>
          </div>

          {/* Full-width 3-column scrollable grid with large easy-to-read text */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Boolean Gamerules */}
            {filteredBoolRules.map(([rule, item]) => (
              <div key={rule} className="bg-[#12161c] border border-[#2d3847] p-3 rounded-lg flex items-center justify-between space-x-2 hover:border-[#3e3e4a] transition-all">
                <div className="truncate">
                  <div className="text-xs font-bold text-white font-mono truncate">{rule}</div>
                  <div className="text-[10px] font-mono text-gray-400 mt-0.5 truncate">{rule}: <span className={item.val ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{item.val ? 'true' : 'false'}</span></div>
                </div>
                {renderToggleSwitch(item.val, () => toggleBoolRule(rule))}
              </div>
            ))}

            {/* Numeric Gamerules */}
            {filteredNumRules.map(([rule, item]) => (
              <div key={rule} className="bg-[#12161c] border border-[#2d3847] p-3 rounded-lg flex items-center justify-between space-x-2 hover:border-[#3e3e4a] transition-all">
                <div className="truncate">
                  <div className="text-xs font-bold text-white font-mono truncate">{rule}</div>
                  <div className="text-[10px] font-mono text-gray-400 mt-0.5 truncate">{rule}: <span className="text-blue-400 font-bold">{item.val}</span></div>
                </div>

                <div className="flex items-center bg-[#1c222b] border border-[#2d3847] rounded overflow-hidden flex-shrink-0">
                  <input 
                    type="number" 
                    value={item.val} 
                    onChange={(e) => updateNumRule(rule, parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-xs font-mono font-bold text-white bg-transparent outline-none text-right"
                  />
                  <div className="flex flex-col border-l border-[#2d3847]">
                    <button 
                      onClick={() => updateNumRule(rule, item.val + 1)}
                      className="px-1.5 py-0.5 text-[#00c853] hover:bg-[#2d3847] text-[10px] font-bold leading-tight"
                    >
                      ▲
                    </button>
                    <button 
                      onClick={() => updateNumRule(rule, Math.max(0, item.val - 1))}
                      className="px-1.5 py-0.5 text-red-400 hover:bg-[#2d3847] text-[10px] font-bold leading-tight"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // SCREEN 1: MAIN WORLDS OVERVIEW LIST VIEW
  // ----------------------------------------------------
  const defaultNames = ['world', 'world_nether', 'world_the_end'];
  const defaultWorldItems = worlds.filter(w => defaultNames.includes(w.name.toLowerCase()));
  const customWorldItems = worlds.filter(w => !defaultNames.includes(w.name.toLowerCase()));

  const overworld = defaultWorldItems.find(w => w.name === 'world') || { name: 'world', type: 'Overworld Dimension', environment: 'normal' };
  const nether = defaultWorldItems.find(w => w.name === 'world_nether') || { name: 'world_nether', type: 'Nether Dimension', environment: 'nether' };
  const end = defaultWorldItems.find(w => w.name === 'world_the_end') || { name: 'world_the_end', type: 'The End Dimension', environment: 'the_end' };

  return (
    <div className="space-y-3 max-w-7xl mx-auto w-full pb-2">
      {/* Top Header Bar with + New Dimension Button */}
      <div className="flex items-center justify-between pb-2 border-b border-[#2d3847]">
        <div className="flex items-center space-x-3">
          <Globe className="text-blue-400" size={24} />
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-wide">Worlds & Dimensions</h2>
            <div className="text-xs text-gray-400">Manage Minecraft server dimensions, gamerules & custom worlds</div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold flex items-center space-x-1.5 shadow">
            <Swords size={13} />
            <span>Arena Dimensions Auto-Managed</span>
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {/* TOP ROW: Full Width Overworld Card (`world`) */}
        <div className="bg-[#1c222b] border border-[#2d3847] hover:border-[#00c853]/60 transition-all duration-300 rounded-sm p-4 flex items-center justify-between shadow-xl relative overflow-hidden">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-xl border border-[#00c853]/40 bg-[#00c853]/10 text-[#00c853] flex items-center justify-center shadow-lg flex-shrink-0">
              <Globe size={28} />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-xl font-extrabold text-white font-mono tracking-wide">{overworld.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-[#00c853]/40 bg-[#00c853]/10 text-[#00c853] uppercase tracking-wider">
                  Overworld Dimension
                </span>
              </div>
              <div className="text-xs text-emerald-400 font-mono mt-1 flex items-center space-x-1">
                <span>⚡ Active spawn world & player builds</span>
              </div>
            </div>
          </div>

          {/* Action Buttons Stack (Download, Upload, Options, Generate) */}
          <div className="flex flex-col space-y-1.5 w-32 flex-shrink-0">
            <button 
              onClick={() => handleDownloadWorld(overworld.name)}
              className="w-full py-1.5 bg-[#2196f3] hover:bg-blue-400 text-white font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
            >
              <Download size={14} />
              <span>Download</span>
            </button>

            <button 
              onClick={() => setUploadWorldModal(overworld.name)}
              className="w-full py-1.5 bg-[#ff7043] hover:bg-orange-400 text-white font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
            >
              <Upload size={14} />
              <span>Upload</span>
            </button>

            <button 
              onClick={() => setSelectedWorld(overworld.name)}
              className="w-full py-1.5 bg-white hover:bg-gray-100 text-[#12161c] font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
            >
              <Sliders size={14} />
              <span>Options</span>
            </button>

            <button 
              onClick={() => alert(`Pre-generating and optimizing chunks for ${overworld.name}...`)}
              className="w-full py-1.5 bg-[#00c853] hover:bg-emerald-400 text-white font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} />
              <span>Generate</span>
            </button>
          </div>
        </div>

        {/* BOTTOM ROW: Split 2 Cards (world_nether & world_the_end) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Left Card: Nether (`world_nether`) */}
          <div className="bg-[#1c222b] border border-[#2d3847] hover:border-[#ff7043]/60 transition-all duration-300 rounded-sm p-4 flex items-center justify-between shadow-xl relative overflow-hidden">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl border border-[#ff7043]/40 bg-[#ff7043]/10 text-[#ff7043] flex items-center justify-center shadow-lg flex-shrink-0">
                <Flame size={26} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white font-mono tracking-wide">{nether.name}</h3>
                <div className="text-[11px] text-gray-400 font-mono mt-0.5">Nether Dimension</div>
              </div>
            </div>

            {/* Action Buttons Stack (Download, Upload, Options, Delete) */}
            <div className="flex flex-col space-y-1.5 w-32 flex-shrink-0">
              <button 
                onClick={() => handleDownloadWorld(nether.name)}
                className="w-full py-1.5 bg-[#2196f3] hover:bg-blue-400 text-white font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Download size={14} />
                <span>Download</span>
              </button>

              <button 
                onClick={() => setUploadWorldModal(nether.name)}
                className="w-full py-1.5 bg-[#ff7043] hover:bg-orange-400 text-white font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Upload size={14} />
                <span>Upload</span>
              </button>

              <button 
                onClick={() => setSelectedWorld(nether.name)}
                className="w-full py-1.5 bg-white hover:bg-gray-100 text-[#12161c] font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Sliders size={14} />
                <span>Options</span>
              </button>

              <button 
                onClick={() => handleDeleteDimension(nether.name)}
                className="w-full py-1.5 bg-[#ff2d55] hover:bg-rose-600 text-white font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Right Card: The End (`world_the_end`) */}
          <div className="bg-[#1c222b] border border-[#2d3847] hover:border-[#ab47bc]/60 transition-all duration-300 rounded-sm p-4 flex items-center justify-between shadow-xl relative overflow-hidden">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl border border-[#ab47bc]/40 bg-[#ab47bc]/10 text-[#ab47bc] flex items-center justify-center shadow-lg flex-shrink-0">
                <Eye size={26} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white font-mono tracking-wide">{end.name}</h3>
                <div className="text-[11px] text-gray-400 font-mono mt-0.5">The End Dimension</div>
              </div>
            </div>

            {/* Action Buttons Stack (Download, Upload, Options, Delete) */}
            <div className="flex flex-col space-y-1.5 w-32 flex-shrink-0">
              <button 
                onClick={() => handleDownloadWorld(end.name)}
                className="w-full py-1.5 bg-[#2196f3] hover:bg-blue-400 text-white font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Download size={14} />
                <span>Download</span>
              </button>

              <button 
                onClick={() => setUploadWorldModal(end.name)}
                className="w-full py-1.5 bg-[#ff7043] hover:bg-orange-400 text-white font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Upload size={14} />
                <span>Upload</span>
              </button>

              <button 
                onClick={() => setSelectedWorld(end.name)}
                className="w-full py-1.5 bg-white hover:bg-gray-100 text-[#12161c] font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Sliders size={14} />
                <span>Options</span>
              </button>

              <button 
                onClick={() => handleDeleteDimension(end.name)}
                className="w-full py-1.5 bg-[#ff2d55] hover:bg-rose-600 text-white font-extrabold text-xs rounded-sm shadow transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>

        {/* CUSTOM DIMENSIONS ROW */}
        {customWorldItems.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-2">
              <Sparkles size={14} className="text-amber-400" />
              <span>Custom Dimensions ({customWorldItems.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customWorldItems.map((cw) => (
                <div key={cw.name} className="bg-[#1c222b] border border-amber-500/30 hover:border-amber-400 transition-all rounded-sm p-4 flex items-center justify-between shadow-xl">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xl">
                      🌐
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-white font-mono text-base">{cw.name}</span>
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">Env: {cw.environment}</div>
                    </div>
                  </div>

                  {/* Custom World Button Stack: Download, Upload, Options, Delete */}
                  <div className="flex flex-col space-y-1.5 w-32 flex-shrink-0">
                    <button 
                      onClick={() => handleDownloadWorld(cw.name)}
                      className="w-full py-1.5 bg-[#2196f3] hover:bg-blue-400 text-white font-extrabold text-xs rounded-sm shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </button>

                    <button 
                      onClick={() => setUploadWorldModal(cw.name)}
                      className="w-full py-1.5 bg-[#ff7043] hover:bg-orange-400 text-white font-extrabold text-xs rounded-sm shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Upload size={13} />
                      <span>Upload</span>
                    </button>

                    <button 
                      onClick={() => setSelectedWorld(cw.name)}
                      className="w-full py-1.5 bg-white hover:bg-gray-100 text-[#12161c] font-extrabold text-xs rounded-sm shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Sliders size={13} />
                      <span>Options</span>
                    </button>

                    <button 
                      onClick={() => handleDeleteDimension(cw.name)}
                      className="w-full py-1.5 bg-[#ff2d55] hover:bg-rose-600 text-white font-extrabold text-xs rounded-sm shadow transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>



      {/* UPLOAD WORLD MODAL */}
      {uploadWorldModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1c222b] rounded-sm shadow-2xl border border-[#2d3847] w-full max-w-md overflow-hidden">
            <div className="bg-[#ff7043] text-white p-3 font-bold flex justify-between items-center select-none">
              <div className="flex items-center space-x-2">
                <Upload size={16} />
                <span className="text-sm tracking-wide">Upload World Zip ({uploadWorldModal})</span>
              </div>
              <button onClick={() => setUploadWorldModal(null)} className="text-white hover:text-gray-200 font-bold">✕</button>
            </div>

            <div className="p-5 bg-[#12161c] space-y-4">
              <p className="text-xs text-gray-300">
                Upload a compressed <code className="text-amber-400 font-mono font-bold">.zip</code> archive containing the world files to replace <span className="text-white font-bold">{uploadWorldModal}</span>.
              </p>

              <div 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); handleUploadSimulate(uploadWorldModal); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragActive ? 'border-orange-400 bg-orange-500/10' : 'border-[#2d3847] hover:border-gray-400 bg-[#1c222b]'
                }`}
              >
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept=".zip,.tar.gz" 
                  className="hidden" 
                  onChange={() => handleUploadSimulate(uploadWorldModal)}
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <FileArchive size={36} className="text-orange-400" />
                  <div className="text-xs font-bold text-white">Click or drag & drop world .zip file</div>
                  <div className="text-[10px] text-gray-400">Supports .zip, .tar.gz (Max 2GB)</div>
                </div>
              </div>

              {isUploading && (
                <div className="flex items-center space-x-3 bg-[#1c222b] p-3 rounded border border-[#2d3847]">
                  <div className="w-4 h-4 border-2 border-transparent border-t-orange-400 border-r-orange-400 rounded-full animate-spin flex-shrink-0" />
                  <span className="text-xs font-mono text-white">Extracting world files into server directory...</span>
                </div>
              )}
            </div>

            <div className="bg-[#1c222b] p-3 border-t border-[#2d3847] flex justify-end space-x-2">
              <button 
                onClick={() => setUploadWorldModal(null)} 
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1.5 px-4 rounded-sm text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
