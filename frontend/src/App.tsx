import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, LogOut, Play, Square, XCircle, 
  Settings, Users, Puzzle, ShieldCheck, FileText, Menu, X, Save, RefreshCw,
  Map as MapIcon, Check, Edit2, Copy, Upload,
  CloudUpload, Trash2, Folder, File as FileIcon, CornerUpLeft, Plus, Minus, Sun,
  Plug, Terminal, ArrowRight, Megaphone, Send, RotateCw, Download, UserX, Search, Globe, Swords
} from 'lucide-react';
import { PlayerDetails } from './PlayerDetails';
import { WeatherTab } from './WeatherTab';
import { WorldsTab } from './WorldsTab';
import { EventsTab } from './EventsTab';
import logoImg from './assets/logo.png';

const API_BASE = 'http://localhost:3001/api';
const WS_BASE = 'ws://localhost:3001/api/ws';

type Tab = 'server' | 'console' | 'options' | 'players' | 'worlds' | 'events' | 'plugins' | 'backups' | 'log' | 'map' | 'weather';

export default function App() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'AMOS';
  }, []);
  
  // Global Server State
  const [status, setStatus] = useState<'online' | 'offline' | 'starting'>('offline');
  const [isRestartingServer, setIsRestartingServer] = useState(false);
  const [systemIp, setSystemIp] = useState('192.168.0.101');
  const [ram, setRam] = useState('');
  const [liveRam, setLiveRam] = useState(0);
  const [cpu, setCpu] = useState(0);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const [panelStats, setPanelStats] = useState({ cpu: 0, ram: 0, uptime: 0 });

  // Layout State
  const [currentTab, setCurrentTab] = useState<Tab>('server');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [maxPlayers, setMaxPlayers] = useState('20');
  const [onlinePlayersCount, setOnlinePlayersCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/server/properties`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
           const maxMatch = data.content.match(/^max-players=(.*)$/m);
           if (maxMatch) setMaxPlayers(maxMatch[1].trim() || '20');
        }
      });
  }, [token]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | any;
    if (status === 'online' && token) {
       const fetchPlayers = () => {
         fetch(`${API_BASE}/server/players/online`, { headers: { 'Authorization': `Bearer ${token}` } })
           .then(r => r.json())
           .then(d => {
              if (d.players) setOnlinePlayersCount(d.players.length);
           }).catch(() => {});
       };
       fetchPlayers();
       interval = setInterval(fetchPlayers, 5000);
    } else {
       setOnlinePlayersCount(0);
    }
    return () => clearInterval(interval);
  }, [status, token]);

  useEffect(() => {
    const savedToken = localStorage.getItem('panel_token');
    if (savedToken) {
      setToken(savedToken);
      fetchStatus(savedToken);
      connectWebSocket(savedToken);
    }

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as any)?.url || '';
        // Only log out if explicitly an auth request fails, not background status polling
        if (url.includes('/api/auth/') || url.includes('/api/panel/stats')) {
          setToken(null);
          localStorage.removeItem('panel_token');
        }
      }
      return response;
    };
    return () => { 
      window.fetch = originalFetch; 
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetchPanelStats = () => {
      fetch(`${API_BASE}/panel/stats`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (data.success) setPanelStats({ cpu: data.cpu, ram: data.ram, uptime: data.uptime || 0 }); })
        .catch(() => {});
    };
    fetchPanelStats();
    const intv = setInterval(fetchPanelStats, 3000);
    return () => clearInterval(intv);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchStatus(token);
    const statusIntv = setInterval(() => {
      fetchStatus(token);
    }, 2000);
    return () => clearInterval(statusIntv);
  }, [token]);

  const fetchStatus = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/server/status`, { headers: { 'Authorization': `Bearer ${authToken}` } });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        if (data.status === 'online') setIsRestartingServer(false);
        if (data.systemIp) setSystemIp(data.systemIp);
        setRam(data.ramAllocation);
      } else {
        logout();
      }
    } catch (e) {}
  };

  const connectWebSocket = (authToken: string) => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(`${WS_BASE}?token=${authToken}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'console') {
        setConsoleLines((prev) => [...prev, data.data].slice(-1000));
      } else if (data.type === 'status') {
        setStatus(data.status);
        if (data.status === 'online') setIsRestartingServer(false);
        if (data.status === 'offline') { setCpu(0); setLiveRam(0); }
      } else if (data.type === 'usage') {
        setCpu(data.cpu);
        setLiveRam(Math.round(data.memory / 1024 / 1024));
      }
    };
    
    ws.onclose = () => setTimeout(() => { if (token) connectWebSocket(token); }, 5000);
    wsRef.current = ws;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        localStorage.setItem('panel_token', data.token);
        fetchStatus(data.token);
        connectWebSocket(data.token);
      } else alert('Invalid password');
    } catch (e) { alert('Login failed'); }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('panel_token');
    if (wsRef.current) wsRef.current.close();
  };

  if (!token) return <LoginScreen password={password} setPassword={setPassword} handleLogin={handleLogin} />;

  const tabs = [
    { id: 'server', label: 'Server', icon: Server },
    { id: 'console', label: 'Console', icon: Terminal },
    { id: 'options', label: 'Options', icon: Settings },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'worlds', label: 'Worlds', icon: Globe },
    { id: 'events', label: 'Events', icon: Swords },
    { id: 'weather', label: 'Weather & Time', icon: Sun },
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'plugins', label: 'Plugins', icon: Puzzle },
    { id: 'backups', label: 'Backups', icon: ShieldCheck },
    { id: 'log', label: 'Log', icon: FileText },
  ] as const;

  return (
    <div className="min-h-screen bg-[#1e1e24] text-gray-200 font-sans flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-black px-4 py-2 flex items-center justify-between border-b border-[#22222b]">
        <img 
          src={logoImg} 
          alt="AMOS Logo" 
          className="h-10 w-auto object-contain"
        />
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white">
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar (AMOS Branding) */}
      <aside className={`${mobileMenuOpen ? 'flex' : 'hidden'} md:flex w-full md:w-64 bg-[#2b2b36] border-r border-[#3e3e4a] flex-shrink-0 flex-col h-screen sticky top-0`}>
        {/* Header Section (Pure Black Background - Clean Covered Logo) */}
        <div className="hidden md:flex items-center justify-center bg-black border-b border-[#22222b] p-1.5 h-24 overflow-hidden">
          <img 
            src={logoImg} 
            alt="AMOS Logo" 
            className="w-full h-full object-contain"
          />
        </div>

        <nav className="flex-1 py-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            if (tab.id === 'server') {
              const isOnline = status === 'online';
              const isStarting = status === 'starting';
              const bgColor = isOnline ? 'bg-[#18606e]' : isStarting ? 'bg-[#2b4c7e]' : 'bg-[#2b2b36]';
              const stripColor = isOnline ? 'bg-[#00e020]' : isStarting ? 'bg-blue-400' : 'bg-[#ff0000]';
              const selectedShadow = isActive ? 'shadow-[inset_0_4px_14px_rgba(0,0,0,0.65)]' : 'shadow-md';

              return (
                <button
                  key={tab.id}
                  onClick={() => { setCurrentTab(tab.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-stretch h-20 transition-all ${bgColor} ${selectedShadow} mb-1`}
                >
                  <div className={`w-1.5 flex-shrink-0 ${stripColor}`}></div>
                  <div className="flex-1 flex items-center justify-between pr-5 pl-6">
                     <div className="flex items-center text-white">
                        <Icon size={28} className="mr-3.5 opacity-95" strokeWidth={1.8} />
                        <span className="text-2xl tracking-wide font-medium">Server</span>
                     </div>
                     <div>
                        {isOnline ? (
                           <div className="px-3.5 py-1 bg-[#00e020] text-white rounded-full text-sm font-normal shadow-md tracking-wide">
                             {onlinePlayersCount}/{maxPlayers}
                           </div>
                        ) : isStarting ? (
                           <RefreshCw size={22} className="text-white animate-spin" />
                        ) : (
                           <div className="w-6 h-6 rounded-full bg-[#ff0000] flex items-center justify-center shadow">
                              <div className="w-2.5 h-2.5 bg-white rounded-none"></div>
                           </div>
                        )}
                     </div>
                  </div>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => { setCurrentTab(tab.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center h-12 transition-colors ${
                  isActive ? 'bg-[#3e3e4a] text-white border-l-4 border-[#1f8fc1] pl-7' : 'text-[#8899a6] hover:bg-[#3e3e4a]/30 hover:text-white border-l-4 border-transparent pl-7'
                }`}
              >
                <Icon size={18} className="mr-4 opacity-80" strokeWidth={1.5} />
                <span className="font-medium text-xs uppercase tracking-wider">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#3e3e4a] space-y-4">
          <button onClick={logout} className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-[#3e3e4a] hover:bg-red-500/20 hover:text-red-400 rounded transition-colors text-sm font-medium">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
          <div className="bg-[#1e1e24] p-3 rounded flex flex-col space-y-2 border border-[#3e3e4a] text-xs font-mono">
            <div className="flex justify-between items-center text-gray-400">
              <span>PANEL CPU</span>
              <span className="text-emerald-400">{panelStats.cpu.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center text-gray-400">
              <span>PANEL RAM</span>
              <span className="text-emerald-400">{(panelStats.ram / 1024 / 1024).toFixed(1)} MB</span>
            </div>
            <div className="flex justify-between items-center text-gray-400">
              <span>PANEL GPU</span>
              <span className="text-gray-500">N/A</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col bg-[#1e1e24] ${currentTab === 'console' ? 'h-screen overflow-hidden p-0' : currentTab === 'server' ? 'h-screen overflow-hidden p-4 md:p-6' : currentTab === 'map' ? 'overflow-hidden' : 'overflow-y-auto p-4 md:p-8'}`}>
        <div className={`w-full mx-auto flex-1 flex flex-col min-h-0 ${(currentTab === 'map' || currentTab === 'console') ? '' : (currentTab === 'server' || currentTab === 'players' || currentTab === 'worlds' || currentTab === 'events') ? 'max-w-7xl' : 'max-w-5xl'}`}>
          {currentTab === 'server' && (
            <ServerTab 
              token={token} status={status} ram={ram} liveRam={liveRam} cpu={cpu} panelUptime={panelStats.uptime}
              consoleLines={consoleLines}
              onNavigateToConsole={() => setCurrentTab('console')}
              isRestartingServer={isRestartingServer}
              setIsRestartingServer={setIsRestartingServer}
              systemIp={systemIp}
            />
          )}
          {currentTab === 'console' && (
            <ConsoleTab 
              status={status} consoleLines={consoleLines} wsRef={wsRef} 
            />
          )}
          {currentTab === 'options' && <OptionsTab token={token} />}
          {currentTab === 'players' && <PlayersTab token={token} />}
          {currentTab === 'worlds' && <WorldsTab token={token} />}
          {currentTab === 'events' && <EventsTab token={token} />}
          {currentTab === 'plugins' && <PluginsTab token={token} />}
          {currentTab === 'backups' && <BackupsTab token={token} />}
          {currentTab === 'map' && <MapTab token={token} />}
          {currentTab === 'log' && <LogTab token={token} />}
          {currentTab === 'weather' && <WeatherTab token={token} />}
        </div>
      </main>
    </div>
  );
}

// --- Components ---

function LoginScreen({ password, setPassword, handleLogin }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e1e24] text-white p-4">
      <div className="w-full max-w-md rounded-lg bg-[#2b2b36] border border-[#3e3e4a] shadow-2xl overflow-hidden">
        <div className="bg-black p-6 flex flex-col items-center justify-center border-b border-[#22222b]">
          <img src={logoImg} alt="AMOS Logo" className="h-16 w-auto object-contain" />
        </div>
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <input
            type="password"
            placeholder="Master Password"
            className="w-full px-4 py-3 rounded bg-[#1e1e24] border border-[#3e3e4a] focus:border-emerald-500 outline-none text-sm font-mono"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full py-3 rounded bg-[#00c853] hover:bg-emerald-400 text-white font-bold text-sm shadow transition-all cursor-pointer">
            Unlock AMOS
          </button>
        </form>
      </div>
    </div>
  );
}

function ConsoleTab({ status, consoleLines, wsRef }: any) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [consoleLines]);

  const executeSubmit = () => {
    const trimmed = command.trim();
    if (!trimmed || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'command', command: trimmed }));
    
    // Add command to history array
    setHistory(prev => (prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]));
    setHistoryIndex(-1);
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setCommand(history[newIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;

      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        setCommand('');
      } else {
        setHistoryIndex(newIndex);
        setCommand(history[newIndex] || '');
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden bg-[#12161c]">
      {/* Top Header Bar */}
      <div className="flex justify-between items-center bg-[#1c222b] px-6 py-3.5 border-b border-[#2d3847] flex-shrink-0 shadow-sm">
        <div className="flex items-center space-x-3">
          <Terminal className="text-emerald-400" size={24} />
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Live Console</h2>
            <div className="text-xs text-gray-400">Interactive Minecraft server terminal console</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow ${
            status === 'online' ? 'bg-[#00c853]' : status === 'starting' ? 'bg-blue-500' : 'bg-[#ff2d55]'
          }`}>
            {status}
          </span>
        </div>
      </div>

      {/* Main Terminal Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#12161c]">
        {/* Terminal Log Output Window */}
        <div className="flex-1 p-5 overflow-y-auto font-mono text-xs leading-relaxed space-y-1">
          {consoleLines.length === 0 ? (
            <div className="p-8 text-center text-gray-500 font-mono">No console output received yet...</div>
          ) : (
            consoleLines.map((line: string, i: number) => parseLogLine(line, i))
          )}
          <div ref={consoleEndRef} />
        </div>

        {/* Command Input Bar (div instead of form to prevent browser password manager popups) */}
        <div className="p-4 border-t border-[#2d3847] bg-[#181d24] flex space-x-3 flex-shrink-0 relative">
          {/* Dummy hidden inputs to trap browser autofill heuristics */}
          <input type="text" className="hidden" tabIndex={-1} autoComplete="username" readOnly value="none" />
          <input type="password" className="hidden" tabIndex={-1} autoComplete="current-password" readOnly value="none" />

          <input
            type="search"
            name="mc_terminal_cmd_query_search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-autocomplete="none"
            data-lpignore="true"
            data-form-type="other"
            data-1p-ignore="true"
            data-bwignore="true"
            placeholder="Type a command (e.g. op username, gamemode creative)..."
            className="flex-1 px-4 py-2.5 rounded-sm bg-[#12161c] border border-[#2d3847] text-white focus:border-blue-500 outline-none font-mono text-xs placeholder:text-gray-600 shadow-inner"
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              setHistoryIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            disabled={status === 'offline'}
          />
          <button 
            type="button" 
            onClick={executeSubmit}
            disabled={status === 'offline' || !command.trim()}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-sm font-bold text-xs transition-colors cursor-pointer shadow"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function formatUptime(totalSeconds: number) {
  if (!totalSeconds || isNaN(totalSeconds)) return '00m 00s';
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  if (d > 0) return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function ServerTab({ token, status, ram, liveRam, cpu, panelUptime, consoleLines, onNavigateToConsole, isRestartingServer, setIsRestartingServer, systemIp = '192.168.0.101' }: any) {
  const [serverName, setServerName] = useState('craft.neopix.in');
  const [serverType, setServerType] = useState('PaperMC');
  const [serverVersion, setServerVersion] = useState('1.20.6');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectEdition, setConnectEdition] = useState<'java' | 'bedrock'>('java');
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedLocal, setCopiedLocal] = useState(false);
  const [copiedPort, setCopiedPort] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  // Panel Uptime & Restart State
  const [localUptime, setLocalUptime] = useState(panelUptime || 0);
  const [showRestartPanelModal, setShowRestartPanelModal] = useState(false);
  const [isRestartingPanel, setIsRestartingPanel] = useState(false);

  useEffect(() => {
    if (panelUptime) setLocalUptime(panelUptime);
  }, [panelUptime]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalUptime((prev: number) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleConfirmRestartPanel = async () => {
    setIsRestartingPanel(true);
    try {
      await fetch(`${API_BASE}/panel/restart`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {}
    
    setTimeout(() => {
      setIsRestartingPanel(false);
      setShowRestartPanelModal(false);
      window.location.reload();
    }, 4000);
  };

  useEffect(() => {
    fetch(`${API_BASE}/server/properties`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
           const match = data.content.match(/^server-name=(.*)$/m);
           if (match) setServerName(match[1].trim() || 'craft.neopix.in');
        }
      });
  }, [token]);

  const serverAction = async (action: 'start' | 'stop' | 'kill' | 'restart') => {
    if (isRestartingServer && action !== 'kill') return;
    if (action === 'restart') {
      setIsRestartingServer(true);
    }
    if (action === 'kill') {
      setIsRestartingServer(false);
    }
    try { 
      await fetch(`${API_BASE}/server/${action}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }); 
    } catch (e) {
      if (action === 'restart') setIsRestartingServer(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    if (status !== 'online') {
      alert("Server must be ONLINE to broadcast chat messages!");
      return;
    }
    
    try {
      const tellrawPayload = JSON.stringify([
        "",
        { text: "[", color: "yellow" },
        { text: "Server", color: "red" },
        { text: "]: ", color: "yellow" },
        { text: chatMessage.trim(), color: "green" }
      ]);

      await fetch(`${API_BASE}/server/command`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `tellraw @a ${tellrawPayload}` })
      });
      setChatMessage('');
      setBroadcastSuccess(true);
      setTimeout(() => setBroadcastSuccess(false), 2500);
    } catch (err) {
      alert("Failed to broadcast message");
    }
  };

  const copyToClipboard = (text: string, type: 'domain' | 'local') => {
    navigator.clipboard.writeText(text);
    if (type === 'domain') {
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    } else {
      setCopiedLocal(true);
      setTimeout(() => setCopiedLocal(false), 2000);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto pb-2">
      {/* Upgraded Industrial Server Card (Aternos / Industrial Style) */}
      <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm overflow-hidden shadow-xl">
        
        {/* Header: Domain Name & Connect Button */}
        <div className="py-5 px-4 text-center bg-[#181d24] flex flex-col items-center justify-center space-y-3.5 border-b border-[#2d3847]">
          <div className="flex items-center justify-center space-x-2">
            <h2 className="text-3xl font-extrabold text-white tracking-wide">{serverName}</h2>
            <button 
              onClick={() => copyToClipboard(serverName, 'domain')}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Copy Domain"
            >
              {copiedDomain ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
            </button>
          </div>

          {/* Connect Button matching Image 2 */}
          <button 
            onClick={() => setShowConnectModal(true)}
            className="flex items-center space-x-1.5 bg-white hover:bg-gray-100 text-[#1c222b] font-bold text-xs px-5 py-1.5 rounded-sm shadow border border-gray-300 transition-all cursor-pointer select-none"
          >
            <Plug size={14} className="text-[#1c222b]" />
            <span>Connect</span>
          </button>
        </div>

        {/* Full-Width Status Banner (Green ONLINE / Red OFFLINE / Blue PREPARING & STARTING / Gray RESTARTING) */}
        <div className={`py-3 text-center font-extrabold text-lg tracking-widest uppercase text-white shadow-inner flex items-center justify-center space-x-2 transition-colors duration-300 ${
          isRestartingServer ? 'bg-[#4a5568]' : status === 'online' ? 'bg-[#00c853]' : status === 'starting' ? 'bg-[#2196f3]' : 'bg-[#ff2d55]'
        }`}>
          <span className={`w-3 h-3 rounded-full ${
            isRestartingServer ? 'bg-white animate-ping' : status === 'online' ? 'bg-white animate-pulse' : status === 'starting' ? 'bg-white animate-ping' : 'bg-white/80'
          }`} />
          <span>
            {isRestartingServer ? 'RESTARTING...' : status === 'starting' ? 'PREPARING & STARTING...' : status}
          </span>
        </div>

        {/* Industrial Action Bar (Centered Control Buttons) */}
        <div className="p-4 flex items-center justify-center bg-[#1c222b] border-b border-[#2d3847]">
          {status === 'offline' && !isRestartingServer ? (
            <button 
              onClick={() => serverAction('start')} 
              disabled={isRestartingServer || status === 'starting'}
              className="px-14 py-3 bg-[#00c853] hover:bg-emerald-400 text-white rounded-sm text-lg font-bold flex items-center shadow-lg transition-transform active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <Play size={22} className="mr-2 fill-current" /> START
            </button>
          ) : (
            <div className="flex flex-wrap justify-center gap-4">
              <button 
                onClick={() => serverAction('stop')} 
                disabled={isRestartingServer || status === 'starting'}
                className={`px-7 py-2.5 text-white rounded-sm text-base font-bold flex items-center shadow-md transition-all ${
                  isRestartingServer || status === 'starting'
                    ? 'bg-gray-700 opacity-40 pointer-events-none cursor-not-allowed select-none' 
                    : 'bg-[#ff9800] hover:bg-amber-400 active:scale-95 cursor-pointer'
                }`}
              >
                <Square size={18} className="mr-2 fill-current" /> STOP
              </button>
              <button 
                onClick={() => serverAction('restart')} 
                disabled={isRestartingServer || status === 'starting'}
                className={`px-7 py-2.5 text-white rounded-sm text-base font-bold flex items-center shadow-md transition-all ${
                  isRestartingServer || status === 'starting'
                    ? 'bg-gray-600 opacity-80 pointer-events-none cursor-not-allowed select-none' 
                    : 'bg-[#2196f3] hover:bg-blue-400 active:scale-95 cursor-pointer'
                }`}
              >
                <RefreshCw size={18} className={`mr-2 ${isRestartingServer || status === 'starting' ? 'animate-spin' : ''}`} /> 
                {isRestartingServer ? 'RESTARTING...' : status === 'starting' ? 'STARTING...' : 'RESTART'}
              </button>
              <button 
                onClick={() => serverAction('kill')} 
                className="px-7 py-2.5 bg-[#f44336] hover:bg-red-500 text-white rounded-sm text-base font-bold flex items-center shadow-md transition-transform active:scale-95 cursor-pointer"
                title="Emergency Force Kill Process"
              >
                <XCircle size={18} className="mr-2" /> KILL
              </button>
            </div>
          )}
        </div>
        
        {/* Live Metrics Bar (3 Columns: CPU, RAM, Panel Uptime) */}
        <div className="grid grid-cols-3 bg-[#161b22]">
          <div className="py-4 md:py-5 px-4 text-center border-r border-[#2d3847]">
            <div className="text-xs text-gray-400 font-mono uppercase tracking-widest">CPU USAGE</div>
            <div className="text-xl font-mono font-bold text-[#00e020] mt-1">{cpu.toFixed(1)}%</div>
          </div>
          <div className="py-4 md:py-5 px-4 text-center border-r border-[#2d3847]">
            <div className="text-xs text-gray-400 font-mono uppercase tracking-widest">RAM USAGE</div>
            <div className="text-xl font-mono font-bold text-[#2196f3] mt-1">{liveRam} / {ram} MB</div>
          </div>
          <div className="py-4 md:py-5 px-4 text-center flex flex-col items-center justify-center relative">
            <div className="text-xs text-gray-400 font-mono uppercase tracking-widest">PANEL UPTIME</div>
            <div className="text-xl font-mono font-bold text-purple-400 mt-1">{formatUptime(localUptime)}</div>
            
            {/* Top-Right Corner Restart Symbol */}
            <button
              onClick={() => setShowRestartPanelModal(true)}
              className="absolute top-2.5 right-3 p-1.5 text-purple-400 hover:text-white bg-purple-500/10 hover:bg-purple-600 rounded border border-purple-500/20 transition-all cursor-pointer shadow-sm"
              title="Restart MinePanel Service & Minecraft Server"
            >
              <RotateCw size={13} className={isRestartingPanel ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* 3-Line Attached Ticker Terminal Bar with Colorful Output */}
        <div className="bg-[#12161c] border-t border-[#2d3847] p-3 flex items-start justify-between font-mono text-xs text-gray-300 select-none overflow-hidden min-h-[90px]">
          <div className="flex items-start space-x-2.5 overflow-hidden flex-1 mr-4">
            <Terminal size={16} className="text-emerald-400 animate-pulse flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1 overflow-hidden">
              {consoleLines.length > 0 ? (
                consoleLines.slice(-3).map((line: string, i: number) => (
                  <div key={i} className="truncate">{parseLogLine(line, i)}</div>
                ))
              ) : (
                <span className="text-gray-500 italic">Server idle. Waiting for log output...</span>
              )}
            </div>
          </div>
          <button 
            onClick={onNavigateToConsole}
            className="text-[#2196f3] hover:text-blue-300 font-bold text-xs flex items-center flex-shrink-0 transition-colors cursor-pointer hover:underline mt-0.5"
          >
            <span>Console</span>
            <ArrowRight size={14} className="ml-1" />
          </button>
        </div>
      </div>

      {/* Quick Dashboard Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Interactive Software & Version Selectors */}
        <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-4 shadow-md">
          <div className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-2">Server Software & Version</div>
          <div className="flex items-center space-x-2">
            <select 
              value={serverType}
              onChange={(e) => setServerType(e.target.value)}
              disabled={status !== 'offline'}
              className="bg-[#12161c] text-white border border-[#2d3847] h-9 px-2.5 rounded-sm font-bold flex-1 text-center outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs transition-colors focus:border-blue-500"
            >
              <option value="PaperMC">PaperMC</option>
              <option value="Spigot">Spigot</option>
              <option value="Vanilla">Vanilla</option>
              <option value="Forge">Forge</option>
              <option value="Fabric">Fabric</option>
            </select>
            <select 
              value={serverVersion}
              onChange={(e) => setServerVersion(e.target.value)}
              disabled={status !== 'offline'}
              className="bg-[#12161c] text-white border border-[#2d3847] h-9 px-2.5 rounded-sm font-bold w-24 text-center outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs transition-colors focus:border-blue-500"
            >
              <option value="1.20.6">1.20.6</option>
              <option value="1.20.4">1.20.4</option>
              <option value="1.19.4">1.19.4</option>
              <option value="1.18.2">1.18.2</option>
              <option value="1.16.5">1.16.5</option>
            </select>
          </div>
        </div>

        {/* Card 2: Network Ports */}
        <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-4 shadow-md">
          <div className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">Network Ports</div>
          <div className="text-xs font-mono text-gray-200 flex items-center justify-between mt-2">
             <div><span className="text-gray-400">Java Port:</span> <strong className="text-emerald-400 font-bold">25565</strong></div>
             <div><span className="text-gray-400">Bedrock:</span> <strong className="text-blue-400 font-bold">19132</strong></div>
          </div>
        </div>

        {/* Card 3: Full Console Navigation */}
        <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-4 shadow-md flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">Full Console</div>
            <div className="text-sm font-bold text-white">Interactive Terminal</div>
          </div>
          <button 
            onClick={onNavigateToConsole}
            className="bg-[#2196f3] hover:bg-blue-400 text-white font-bold px-3.5 py-1.5 rounded-sm text-xs transition-colors flex items-center cursor-pointer shadow"
          >
            Open Console
          </button>
        </div>
      </div>

      {/* In-Game Server Broadcast & Chat Bar */}
      <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono text-gray-400 uppercase tracking-wider">
            <Megaphone size={16} className="text-amber-400" />
            <span>SERVER BROADCAST & GAME CHAT</span>
          </div>
          {broadcastSuccess && (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <Check size={14} /> Broadcast Sent to In-Game Chat!
            </span>
          )}
        </div>

        <form onSubmit={handleSendChat} className="flex items-center space-x-2">
          <div className="bg-[#12161c] border border-[#2d3847] rounded-sm px-3 py-2 font-mono text-xs shadow-inner flex-shrink-0 select-none flex items-center space-x-0.5">
            <span className="text-yellow-400 font-bold">[</span>
            <span className="text-red-500 font-normal">Server</span>
            <span className="text-yellow-400 font-bold">]:</span>
          </div>
          <input 
            type="text"
            placeholder="Type a message to broadcast in-game (e.g. Everyone is requested not to fight)..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            disabled={status !== 'online'}
            className="flex-1 bg-[#12161c] border border-[#2d3847] rounded-sm px-3.5 py-2 text-emerald-400 placeholder:text-gray-600 text-xs font-mono font-medium outline-none focus:border-amber-400 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status !== 'online' || !chatMessage.trim()}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 font-extrabold px-5 py-2 rounded-sm text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow flex-shrink-0"
          >
            <Send size={14} />
            <span>Broadcast</span>
          </button>
        </form>
      </div>

      {/* Connect Modal matching Image 3 with Java & Bedrock IPs */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[999] p-4">
          <div className="bg-[#1c222b] rounded-sm shadow-2xl border border-[#2d3847] w-full max-w-md overflow-hidden">
             {/* Header */}
             <div className="bg-[#00c853] text-white font-extrabold px-4 py-2.5 flex items-center justify-between select-none">
                <span className="text-base tracking-wide flex items-center">
                  <Plug size={18} className="mr-2" /> Connect to Server
                </span>
                <button 
                  onClick={() => setShowConnectModal(false)} 
                  className="bg-white text-[#00c853] w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs hover:bg-gray-100 cursor-pointer shadow"
                >
                  ✕
                </button>
             </div>
             
             {/* Edition Switcher Tabs */}
             <div className="flex border-b border-[#2d3847] bg-[#161b22] text-xs font-bold font-mono">
                <button 
                  onClick={() => setConnectEdition('java')}
                  className={`flex-1 py-2.5 text-center transition-colors cursor-pointer border-b-2 ${
                    connectEdition === 'java' 
                      ? 'border-[#00c853] text-emerald-400 bg-[#1c222b]' 
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  ☕ Java Edition (PC)
                </button>
                <button 
                  onClick={() => setConnectEdition('bedrock')}
                  className={`flex-1 py-2.5 text-center transition-colors cursor-pointer border-b-2 ${
                    connectEdition === 'bedrock' 
                      ? 'border-[#2196f3] text-blue-400 bg-[#1c222b]' 
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  📱 Bedrock / Mobile
                </button>
             </div>

             {/* Body */}
             <div className="p-5 bg-[#12161c] space-y-4 text-white font-mono text-sm">
                {connectEdition === 'java' ? (
                  <>
                    <div className="space-y-1">
                       <div className="text-gray-400 text-xs uppercase tracking-wider font-bold">Public Domain IP</div>
                       <div className="flex items-center justify-between bg-[#1c222b] p-2.5 rounded border border-[#2d3847]">
                          <span className="text-emerald-400 font-bold break-all">{serverName}:25565</span>
                          <button 
                            onClick={() => copyToClipboard(`${serverName}:25565`, 'domain')}
                            className="ml-2 text-gray-400 hover:text-white p-1"
                            title="Copy Java Public IP"
                          >
                            {copiedDomain ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                          </button>
                       </div>
                    </div>

                    <div className="space-y-1">
                       <div className="text-gray-400 text-xs uppercase tracking-wider font-bold">Local Network IP (System LAN)</div>
                       <div className="flex items-center justify-between bg-[#1c222b] p-2.5 rounded border border-[#2d3847]">
                          <span className="text-blue-400 font-bold break-all">{systemIp}:25565</span>
                          <button 
                            onClick={() => copyToClipboard(`${systemIp}:25565`, 'local')}
                            className="ml-2 text-gray-400 hover:text-white p-1"
                            title="Copy Java Local IP"
                          >
                            {copiedLocal ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                          </button>
                       </div>
                    </div>

                    <div className="pt-2 border-t border-[#2d3847] text-xs text-gray-400 space-y-1">
                       <div><strong className="text-gray-300">Java Port:</strong> 25565</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                       <div className="text-gray-400 text-xs uppercase tracking-wider font-bold">Public Bedrock Server Address</div>
                       <div className="flex items-center justify-between bg-[#1c222b] p-2.5 rounded border border-[#2d3847]">
                          <span className="text-emerald-400 font-bold break-all">{serverName}</span>
                          <button 
                            onClick={() => copyToClipboard(serverName, 'domain')}
                            className="ml-2 text-gray-400 hover:text-white p-1"
                            title="Copy Bedrock Domain"
                          >
                            {copiedDomain ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                          </button>
                       </div>
                    </div>

                    <div className="space-y-1">
                       <div className="text-gray-400 text-xs uppercase tracking-wider font-bold">Local Network Server Address</div>
                       <div className="flex items-center justify-between bg-[#1c222b] p-2.5 rounded border border-[#2d3847]">
                          <span className="text-blue-400 font-bold break-all">{systemIp}</span>
                          <button 
                            onClick={() => copyToClipboard(systemIp, 'local')}
                            className="ml-2 text-gray-400 hover:text-white p-1"
                            title="Copy Bedrock Local IP"
                          >
                            {copiedLocal ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                          </button>
                       </div>
                    </div>

                    <div className="space-y-1">
                       <div className="text-gray-400 text-xs uppercase tracking-wider font-bold">Bedrock / Geyser Port</div>
                       <div className="flex items-center justify-between bg-[#1c222b] p-2.5 rounded border border-[#2d3847]">
                          <span className="text-amber-400 font-bold break-all">19132</span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText('19132');
                              setCopiedPort(true);
                              setTimeout(() => setCopiedPort(false), 2000);
                            }}
                            className="ml-2 text-gray-400 hover:text-white p-1"
                            title="Copy Bedrock Port"
                          >
                            {copiedPort ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                          </button>
                       </div>
                    </div>

                    <div className="pt-2 border-t border-[#2d3847] text-xs text-gray-400">
                       <p className="text-gray-300 italic">Enter the Address &amp; Port <strong>19132</strong> in Minecraft Pocket Edition / Mobile / Bedrock "Add Server" screen.</p>
                    </div>
                  </>
                )}
             </div>

             {/* Footer */}
             <div className="bg-[#1c222b] p-3 border-t border-[#2d3847] flex justify-center">
                <button 
                  onClick={() => setShowConnectModal(false)} 
                  className="bg-[#00c853] hover:bg-emerald-400 text-white font-extrabold py-2 px-8 rounded-sm shadow flex items-center space-x-1.5 cursor-pointer text-sm"
                >
                  <Check size={16} strokeWidth={3} />
                  <span>Okay</span>
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Restart Panel Confirmation Modal */}
      {showRestartPanelModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#1c222b] rounded-sm shadow-2xl border border-purple-500/40 w-full max-w-md overflow-hidden">
             <div className="bg-purple-700 text-white font-extrabold px-4 py-3 flex items-center justify-between select-none">
                <div className="flex items-center space-x-2">
                  <RotateCw size={18} className="animate-spin" />
                  <span className="text-base tracking-wide">Restart MinePanel Service</span>
                </div>
                <button 
                  onClick={() => setShowRestartPanelModal(false)} 
                  className="bg-white/20 hover:bg-white/30 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
             </div>
             
             <div className="p-5 bg-[#12161c] space-y-4 text-gray-200 text-xs leading-relaxed">
                <p className="font-semibold text-white text-sm">
                  Warning: Are you sure you want to restart MinePanel?
                </p>
                <p className="text-gray-400 bg-purple-950/40 border border-purple-800/40 p-3 rounded">
                  <strong className="text-purple-300">Warning:</strong> Restarting the MinePanel service will restart the entire panel backend daemon and the active Minecraft server.
                </p>

                {isRestartingPanel ? (
                  <div className="p-4 bg-purple-600/20 border border-purple-500/30 rounded text-center text-purple-300 font-mono font-bold animate-pulse">
                    Restarting MinePanel service... Please wait 5 seconds.
                  </div>
                ) : (
                  <div className="flex justify-end space-x-3 pt-2 border-t border-[#2d3847]">
                    <button
                      onClick={() => setShowRestartPanelModal(false)}
                      className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-bold transition-colors cursor-pointer text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmRestartPanel}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-lg text-xs"
                    >
                      <RotateCw size={14} />
                      <span>Restart</span>
                    </button>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MOTDEditor = ({ token, motd, serverName, onChange, onSave }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [iconUrl, setIconUrl] = useState(`${API_BASE}/server/icon?t=${Date.now()}`);
  const editorRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = () => {
    const trimmed = tempName.trim();
    if (!trimmed) {
      setIsEditingName(false);
      return;
    }
    onChange('server-name', trimmed);
    onSave('server-name', trimmed);
    setIsEditingName(false);
  };

  const convertMotdToHtml = (str: string) => {
    if (!str) return '';
    const mcColors: Record<string, string> = {
      '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
      '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
      '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
      'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };
    const parts = str.split(/(?=\\u00A7|§)/);
    let currentColor = '#AAAAAA';
    let isBold = false, isItalic = false, isUnderline = false, isStrikethrough = false, isObfuscated = false;
    
    let html = '';
    parts.forEach((part) => {
      let text = part;
      let codeStr = '';
      if (part.startsWith('\\u00A7')) { codeStr = part.slice(0, 7); text = part.slice(7); } 
      else if (part.startsWith('§')) { codeStr = part.slice(0, 2); text = part.slice(2); }
      
      if (codeStr) {
        const code = codeStr.charAt(codeStr.length - 1).toLowerCase();
        if (mcColors[code]) {
          currentColor = mcColors[code];
          isBold = isItalic = isUnderline = isStrikethrough = isObfuscated = false;
        } else if (code === 'l') isBold = true;
        else if (code === 'o') isItalic = true;
        else if (code === 'n') isUnderline = true;
        else if (code === 'm') isStrikethrough = true;
        else if (code === 'k') isObfuscated = true;
        else if (code === 'r') {
          currentColor = '#AAAAAA';
          isBold = isItalic = isUnderline = isStrikethrough = isObfuscated = false;
        }
      }
      
      if (text) {
        let style = `color: ${currentColor};`;
        if (isBold) style += ' font-weight: bold;';
        if (isItalic) style += ' font-style: italic;';
        if (isUnderline || isStrikethrough) {
           style += ` text-decoration: ${isUnderline ? 'underline ' : ''}${isStrikethrough ? 'line-through' : ''};`;
        }
        let cls = isObfuscated ? 'animate-pulse' : '';
        html += `<span style="${style}" class="${cls}">${text.replace(/\n/g, '<br>')}</span>`;
      }
    });
    return html;
  };

  const convertHtmlToMotd = (element: HTMLElement) => {
    const mcHexToCode: Record<string, string> = {
      'rgb(0, 0, 0)': '0', 'rgb(0, 0, 170)': '1', 'rgb(0, 170, 0)': '2', 'rgb(0, 170, 170)': '3',
      'rgb(170, 0, 0)': '4', 'rgb(170, 0, 170)': '5', 'rgb(255, 170, 0)': '6', 'rgb(170, 170, 170)': '7',
      'rgb(85, 85, 85)': '8', 'rgb(85, 85, 255)': '9', 'rgb(85, 255, 85)': 'a', 'rgb(85, 255, 255)': 'b',
      'rgb(255, 85, 85)': 'c', 'rgb(255, 85, 255)': 'd', 'rgb(255, 255, 85)': 'e', 'rgb(255, 255, 255)': 'f'
    };
    
    let res = '';
    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent && node.textContent.trim() !== '') {
                if (node.parentElement && node.parentElement !== element) {
                    const style = window.getComputedStyle(node.parentElement);
                    const color = style.color;
                    const fw = style.fontWeight;
                    const fs = style.fontStyle;
                    const td = style.textDecoration;
                    
                    if (color && mcHexToCode[color]) res += '\\u00A7' + mcHexToCode[color];
                    else res += '\\u00A77'; 
                    
                    if (fw === 'bold' || parseInt(fw) >= 700) res += '\\u00A7l';
                    if (fs === 'italic') res += '\\u00A7o';
                    if (td.includes('underline')) res += '\\u00A7n';
                    if (td.includes('line-through')) res += '\\u00A7m';
                }
                res += node.textContent;
            } else if (node.textContent) {
                res += node.textContent;
            }
        } else if (node.nodeName === 'BR') {
            res += '\n';
        } else if (node.nodeName === 'DIV' || node.nodeName === 'P') {
            if (res.length > 0 && !res.endsWith('\n')) res += '\n';
            node.childNodes.forEach(walk);
        } else {
            node.childNodes.forEach(walk);
        }
    };
    
    element.childNodes.forEach(walk);
    return res;
  };

  useEffect(() => {
    if (!isEditing && editorRef.current) {
        editorRef.current.innerHTML = convertMotdToHtml(motd);
    }
  }, [motd, isEditing]);

  const insertCode = (code: string, color?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    
    document.execCommand('styleWithCSS', false, 'true');
    
    if (color) {
        document.execCommand('foreColor', false, color);
    } else if (code === 'l') {
        document.execCommand('bold', false, undefined);
    } else if (code === 'o') {
        document.execCommand('italic', false, undefined);
    } else if (code === 'n') {
        document.execCommand('underline', false, undefined);
    } else if (code === 'm') {
        document.execCommand('strikeThrough', false, undefined);
    } else if (code === 'r') {
        document.execCommand('removeFormat', false, undefined);
        document.execCommand('foreColor', false, '#AAAAAA');
    }
    
    const converted = convertHtmlToMotd(editorRef.current);
    onChange('motd', converted);
  };

  const uploadIcon = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, 64, 64);
        const b64 = canvas.toDataURL('image/png');
        
        fetch(`${API_BASE}/server/icon`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: b64 })
        }).then(() => {
          setIconUrl(`${API_BASE}/server/icon?t=${Date.now()}`);
        });
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const toolbarButtons = [
    { code: '0', color: '#000000' }, { code: '1', color: '#0000AA' },
    { code: '2', color: '#00AA00' }, { code: '3', color: '#00AAAA' },
    { code: '4', color: '#AA0000' }, { code: '5', color: '#AA00AA' },
    { code: '6', color: '#FFAA00' }, { code: '7', color: '#AAAAAA' },
    { code: '8', color: '#555555' }, { code: '9', color: '#5555FF' },
    { code: 'a', color: '#55FF55' }, { code: 'b', color: '#55FFFF' },
    { code: 'c', color: '#FF5555' }, { code: 'd', color: '#FF55FF' },
    { code: 'e', color: '#FFFF55' }, { code: 'f', color: '#FFFFFF' }
  ];

  return (
    <div className="bg-[#2b2b36] border border-[#3e3e4a] rounded shadow-sm overflow-hidden mb-6 mt-6">
      <div className="bg-[#1e1e24] p-4 relative" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")' }}>
        <div className="flex items-start">
          <label className="w-16 h-16 bg-white rounded p-1 mr-4 flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer hover:bg-gray-200 transition-colors relative overflow-hidden group">
            <Server size={40} className="text-blue-500 absolute" />
            <img src={iconUrl} onError={(e) => { e.currentTarget.style.opacity = '0'; }} onLoad={(e) => { e.currentTarget.style.opacity = '1'; }} className="w-full h-full object-cover relative z-10" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity z-20">
               <Upload size={20} className="text-white" />
            </div>
            <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={uploadIcon} />
          </label>
          
          <div className="flex-1 font-mono text-[16px] leading-tight" style={{ textShadow: '2px 2px 0 #000' }}>
            <div className="mb-2 flex items-center h-6">
               {isEditingName ? (
                 <div className="flex items-center">
                   <input 
                     ref={nameInputRef}
                     value={tempName}
                     onChange={e => setTempName(e.target.value)}
                     onBlur={() => setIsEditingName(false)}
                     onKeyDown={e => {
                         if (e.key === 'Enter') handleSaveName();
                         if (e.key === 'Escape') { setIsEditingName(false); setTempName(serverName || 'Minecraft Server'); }
                     }}
                     className="bg-black/50 text-[#55FFFF] font-bold px-1 outline-none border border-[#3e3e4a] rounded w-48"
                     autoFocus
                   />
                   <button 
                     onMouseDown={e => e.preventDefault()} 
                     onClick={handleSaveName}
                     className="bg-[#2e3136] border border-[#1e1e24] text-white rounded p-0.5 ml-2 hover:bg-blue-500 hover:border-blue-400 transition-colors"
                     title="Save"
                   >
                     <Check size={14} />
                   </button>
                   <button 
                     onMouseDown={e => e.preventDefault()} 
                     onClick={() => { setIsEditingName(false); setTempName(serverName || 'Minecraft Server'); }}
                     className="bg-[#2e3136] border border-[#1e1e24] text-white rounded p-0.5 ml-1 hover:bg-red-500 hover:border-red-400 transition-colors"
                     title="Cancel"
                   >
                     <X size={14} />
                   </button>
                 </div>
               ) : (
                 <div className="flex items-center group cursor-pointer" onClick={() => { setTempName(serverName || 'Minecraft Server'); setIsEditingName(true); }}>
                   <span className="text-[#55FFFF] font-bold hover:underline">{serverName || 'Minecraft Server'}</span>
                   <span className="bg-gray-800 border border-gray-600 text-gray-300 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-2"><Edit2 size={12} /></span>
                 </div>
               )}
            </div>
            
            <div className="relative w-full min-h-[48px]">
              <div 
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onFocus={() => setIsEditing(true)}
                onBlur={(e) => { 
                   setIsEditing(false); 
                   const converted = convertHtmlToMotd(e.currentTarget);
                   onChange('motd', converted);
                   onSave('motd', converted); 
                }}
                onInput={(e) => {
                   const converted = convertHtmlToMotd(e.currentTarget);
                   onChange('motd', converted);
                }}
                className={`w-full h-full m-0 p-0 break-words outline-none caret-white whitespace-pre-wrap ${isEditing ? 'bg-black/30' : ''}`}
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-[#1e1e24] border-t border-[#3e3e4a] p-3 flex items-center select-none overflow-x-auto">
        <span className="text-[#AAAAAA] font-bold mr-4 text-sm font-mono">§</span>
        <div className="flex space-x-1">
          {toolbarButtons.map(btn => (
            <button 
              key={btn.code}
              onMouseDown={(e) => { e.preventDefault(); insertCode(btn.code, btn.color); }}
              className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs hover:ring-2 hover:ring-white transition-all`}
              style={{ backgroundColor: btn.color, color: (btn.code === 'f' || btn.code === 'e') ? 'black' : 'white', textShadow: (btn.code === 'f' || btn.code === 'e') ? 'none' : '1px 1px 0 #000' }}
            >
              {btn.code}
            </button>
          ))}
          {['l','m','n','o','k','r'].map(btn => (
            <button
              key={btn}
              onMouseDown={(e) => { e.preventDefault(); insertCode(btn); }}
              className="w-6 h-6 rounded bg-[#3e3e4a] text-white hover:bg-gray-500 flex items-center justify-center font-bold text-xs shadow transition-colors"
            >
              {btn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

function OptionsTab({ token }: { token: string }) {
  const [propertiesText, setPropertiesText] = useState('');
  const [propsObj, setPropsObj] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/server/properties`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPropertiesText(data.content);
          const parsed: Record<string, string> = {};
          data.content.split('\n').forEach((line: string) => {
            if (line.trim() && !line.startsWith('#')) {
              const [key, ...rest] = line.split('=');
              if (key) parsed[key.trim()] = rest.join('=').trim();
            }
          });
          setPropsObj(parsed);
        }
        setLoading(false);
      });
  }, [token]);

  const saveSettings = async (key: string, value: string) => {
    setPropsObj(prev => ({ ...prev, [key]: value }));
    const updatedProps = { ...propsObj, [key]: value };
    let lines = propertiesText.split('\n');
    Object.keys(updatedProps).forEach(k => {
      const regex = new RegExp(`^${k}=.*`);
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(regex)) {
          lines[i] = `${k}=${updatedProps[k]}`;
          found = true;
          break;
        }
      }
      if (!found) lines.push(`${k}=${updatedProps[k]}`);
    });
    const newText = lines.join('\n');
    setPropertiesText(newText);
    await fetch(`${API_BASE}/server/properties`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newText })
    });
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading settings...</div>;

  const ToggleCard = ({ label, prop, inverted = false }: { label: string, prop: string, inverted?: boolean }) => {
    let rawVal = propsObj[prop] || 'false';
    // If inverted (like Cracked mode), online-mode=false means Cracked=true (Green Check)
    let isTrue = inverted ? rawVal === 'false' : rawVal === 'true';
    
    return (
      <div className="flex flex-col w-full bg-[#2b2b36] rounded-sm border border-[#3e3e4a] overflow-hidden shadow-sm hover:border-[#525266] transition-colors">
        {/* Top Main Section: Title on Left, Toggle Switch on Right */}
        <div className="flex items-center justify-between px-5 py-3.5 min-h-[62px]">
          <div className="font-medium text-white text-xl tracking-wide font-sans">{label}</div>
          <div 
            onClick={() => {
              const newVal = inverted ? (isTrue ? 'true' : 'false') : (isTrue ? 'false' : 'true');
              saveSettings(prop, newVal);
            }}
            className="relative flex w-[76px] h-[36px] cursor-pointer bg-[#354050] overflow-hidden rounded-none shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)] border border-[#48566a] active:scale-95 transition-transform duration-150"
          >
            <div 
              style={{
                transform: isTrue ? 'translateX(38px)' : 'translateX(0px)',
                transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms ease'
              }}
              className={`absolute top-0 bottom-0 w-[38px] flex items-center justify-center shadow-lg ${
                isTrue ? 'bg-[#00e020]' : 'bg-[#ff0000]'
              }`}
            >
              {isTrue ? (
                <Check size={26} color="white" strokeWidth={3.5} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              ) : (
                <X size={26} color="white" strokeWidth={3.5} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              )}
            </div>
          </div>
        </div>
        {/* Bottom Full-Width Property Tag Strip */}
        <div className="px-5 py-1.5 bg-[#1e1e24] border-t border-[#3e3e4a] text-xs font-mono text-gray-400 tracking-wider">
          {prop}={rawVal}
        </div>
      </div>
    );
  };

  const InputCard = ({ label, prop, type = 'text', suffix }: { label: string, prop: string, type?: string, suffix?: React.ReactNode }) => {
    return (
      <div className="flex flex-col w-full bg-[#2b2b36] rounded-sm border border-[#3e3e4a] overflow-hidden shadow-sm hover:border-[#525266] transition-colors">
        <div className="flex items-center justify-between px-5 py-3.5 min-h-[62px]">
          <div className="font-medium text-white text-xl tracking-wide font-sans">{label}</div>
          <div className="flex items-center justify-end min-w-[180px]">
            <input 
              type={type}
              value={propsObj[prop] || ''}
              onChange={(e) => setPropsObj(prev => ({ ...prev, [prop]: e.target.value }))}
              onBlur={(e) => saveSettings(prop, e.target.value)}
              className="w-full text-center bg-[#1e1e24] text-white font-medium h-10 text-base rounded-sm border border-[#3e3e4a] outline-none px-3 focus:border-blue-500 transition-colors"
            />
            {suffix}
          </div>
        </div>
        <div className="px-5 py-1.5 bg-[#1e1e24] border-t border-[#3e3e4a] text-xs font-mono text-gray-400 tracking-wider">
          {prop}={propsObj[prop] || ''}
        </div>
      </div>
    );
  };

  const SelectCard = ({ label, prop, options }: { label: string, prop: string, options: string[] }) => {
    return (
      <div className="flex flex-col w-full bg-[#2b2b36] rounded-sm border border-[#3e3e4a] overflow-hidden shadow-sm hover:border-[#525266] transition-colors">
        <div className="flex items-center justify-between px-5 py-3.5 min-h-[62px]">
          <div className="font-medium text-white text-xl tracking-wide font-sans">{label}</div>
          <div className="flex items-center justify-end min-w-[180px]">
            <select 
              value={propsObj[prop] || ''}
              onChange={(e) => saveSettings(prop, e.target.value)}
              className="w-full bg-[#1e1e24] text-white font-medium h-10 text-base rounded-sm border border-[#3e3e4a] outline-none px-3 cursor-pointer focus:border-blue-500 transition-colors"
            >
              {options.map(o => <option key={o} value={o.toLowerCase()}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="px-5 py-1.5 bg-[#1e1e24] border-t border-[#3e3e4a] text-xs font-mono text-gray-400 tracking-wider">
          {prop}={propsObj[prop] || ''}
        </div>
      </div>
    );
  };

  const NumberInputCard = ({ label, prop, icon: Icon }: { label: string, prop: string, icon?: any }) => {
    const rawVal = propsObj[prop] || '0';
    const val = parseInt(rawVal, 10) || 0;
    
    const updateVal = (newVal: number) => {
       setPropsObj(prev => ({ ...prev, [prop]: newVal.toString() }));
       saveSettings(prop, newVal.toString());
    };
    
    return (
      <div className="flex flex-col w-full bg-[#2b2b36] rounded-sm border border-[#3e3e4a] overflow-hidden shadow-sm hover:border-[#525266] transition-colors">
        <div className="flex items-center justify-between px-5 py-3.5 min-h-[62px]">
          <div className="font-medium text-white text-xl tracking-wide font-sans">{label}</div>
          <div className="flex items-center justify-end min-w-[180px]">
            <div className="flex items-stretch bg-[#1e1e24] text-white font-medium h-10 w-44 rounded-sm border border-[#3e3e4a] overflow-hidden shadow-inner">
              {Icon && <div className="px-3 flex items-center justify-center text-gray-300 border-r border-[#3e3e4a]"><Icon size={20} /></div>}
              <input 
                type="number"
                value={rawVal}
                onChange={(e) => setPropsObj(prev => ({ ...prev, [prop]: e.target.value }))}
                onBlur={(e) => saveSettings(prop, e.target.value)}
                className="flex-1 min-w-0 w-full text-right bg-transparent outline-none px-3 font-mono text-lg font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex flex-col border-l border-[#3e3e4a] w-7">
                 <button onClick={() => updateVal(val + 1)} className="flex-1 flex items-center justify-center hover:bg-[#3e3e4a] border-b border-[#3e3e4a] transition-colors"><Plus size={13} strokeWidth={3} /></button>
                 <button onClick={() => updateVal(Math.max(0, val - 1))} className="flex-1 flex items-center justify-center hover:bg-[#3e3e4a] transition-colors"><Minus size={13} strokeWidth={3} /></button>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-1.5 bg-[#1e1e24] border-t border-[#3e3e4a] text-xs font-mono text-gray-400 tracking-wider">
          {prop}={rawVal}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      <MOTDEditor 
        token={token}
        motd={propsObj['motd'] !== undefined ? propsObj['motd'] : ''} 
        serverName={propsObj['server-name'] !== undefined ? propsObj['server-name'] : 'craft.neopix.in'}
        onChange={(prop: string, val: string) => setPropsObj(prev => ({ ...prev, [prop]: val }))} 
        onSave={(prop: string, val: string) => saveSettings(prop, val)} 
      />

      {/* Grid matching reference screenshot row-by-row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full">
        <NumberInputCard label="Slots" prop="max-players" icon={Users} />
        <SelectCard label="Gamemode" prop="gamemode" options={['Survival', 'Creative', 'Adventure', 'Spectator']} />
        
        <SelectCard label="Difficulty" prop="difficulty" options={['Peaceful', 'Easy', 'Normal', 'Hard']} />
        <ToggleCard label="Whitelist" prop="white-list" />
        
        <ToggleCard label="Cracked" prop="online-mode" inverted={true} />
        <ToggleCard label="PVP" prop="pvp" />
        
        <ToggleCard label="Commandblocks" prop="enable-command-block" />
        <ToggleCard label="Fly" prop="allow-flight" />
        
        <ToggleCard label="Animals" prop="spawn-animals" />
        <ToggleCard label="Monster" prop="spawn-monsters" />
        
        <ToggleCard label="Villagers" prop="spawn-npcs" />
        <ToggleCard label="Nether" prop="allow-nether" />
        
        <ToggleCard label="Force Gamemode" prop="force-gamemode" />
        <NumberInputCard label="Spawn Protection" prop="spawn-protection" icon={ShieldCheck} />
        
        <ToggleCard label="Resource pack required" prop="require-resource-pack" />
      </div>
      
      {/* Full width inputs */}
      <div className="space-y-3.5">
        <InputCard label="Resource pack" prop="resource-pack" />
        <InputCard label="Resource pack prompt" prop="resource-pack-prompt" />
      </div>
    </div>
  );
}

function PlayersTab({ token }: { token: string }) {
  const [activeList, setActiveList] = useState<'whitelist' | 'ops' | 'banned-players' | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [inputName, setInputName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [allKnownPlayers, setAllKnownPlayers] = useState<{name: string, online: boolean, isOp: boolean, isWhitelisted: boolean, isBanned: boolean}[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);

  const loadOverview = () => {
      Promise.all([
        fetch(`${API_BASE}/server/players/history`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
        fetch(`${API_BASE}/server/players/online`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
        fetch(`${API_BASE}/server/players/ops`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
        fetch(`${API_BASE}/server/players/whitelist`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json()),
        fetch(`${API_BASE}/server/players/banned-players`, { headers: { 'Authorization': `Bearer ${token}` }}).then(r => r.json())
      ]).then(([historyData, onlineData, opsData, whitelistData, bansData]) => {
         const onlineNames = new Set((onlineData.players || []).map((p: any) => p.name));
         const historyNames = new Set((historyData.players || []).map((p: any) => p.name));
         const opsNames = new Set((opsData.players || []).map((p: any) => p.name));
         const whitelistNames = new Set((whitelistData.players || []).map((p: any) => p.name));
         const bansNames = new Set((bansData.players || []).map((p: any) => p.name));
         
         const combined = new Map<string, boolean>();
         historyNames.forEach((name: any) => combined.set(String(name), false));
         onlineNames.forEach((name: any) => combined.set(String(name), true));
         
         const sorted = Array.from(combined.entries())
            .map(([name, online]) => ({ 
              name, 
              online,
              isOp: opsNames.has(name),
              isWhitelisted: whitelistNames.has(name),
              isBanned: bansNames.has(name)
            }))
            .sort((a, b) => (a.online === b.online ? 0 : a.online ? -1 : 1));

         setAllKnownPlayers(sorted);
      });
  };

  useEffect(() => {
    if (activeList === null) {
      loadOverview();
    }
  }, [activeList, token]);

  const quickAction = async (list: 'ops' | 'whitelist' | 'banned-players', action: 'add' | 'remove', name: string) => {
    setAllKnownPlayers(prev => prev.map(p => {
      if (p.name === name) {
        if (list === 'ops') return { ...p, isOp: action === 'add' };
        if (list === 'whitelist') return { ...p, isWhitelisted: action === 'add' };
        if (list === 'banned-players') return { ...p, isBanned: action === 'add' };
      }
      return p;
    }));

    await fetch(`${API_BASE}/server/players/${list}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, name })
    });
    
    setTimeout(loadOverview, 1500);
  };

  const kickPlayer = async (name: string) => {
    await fetch(`${API_BASE}/server/command`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: `kick ${name}` })
    });
    setTimeout(loadOverview, 1000);
  };

  const loadList = async (type: string) => {
    setActiveList(type as any);
    setFilterQuery('');
    setInputName('');
    setShowSuggestions(false);
    setImportStatus(null);
    const res = await fetch(`${API_BASE}/server/players/${type}`, { headers: { 'Authorization': `Bearer ${token}` }});
    const data = await res.json();
    if (data.success) setPlayers(data.players || []);
  };

  const addPlayer = async (nameToAdd?: string) => {
    const targetName = nameToAdd || inputName;
    if (!targetName.trim()) return;
    
    await fetch(`${API_BASE}/server/players/${activeList}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', name: targetName.trim() })
    });
    
    setInputName('');
    setShowSuggestions(false);
    setTimeout(() => loadList(activeList!), 1000);
  };

  const removePlayer = async (name: string) => {
    await fetch(`${API_BASE}/server/players/${activeList}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', name })
    });
    setTimeout(() => loadList(activeList!), 1000);
  };

  // Export List as JSON File
  const handleExportList = () => {
    const listNames = players.map((p: any) => typeof p === 'string' ? p : p.name || p.username);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(listNames, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${activeList}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import List from JSON / TXT File
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(`Reading file ${file.name}...`);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let importedNames: string[] = [];

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            importedNames = parsed.map((item: any) => typeof item === 'string' ? item : item.name || item.username).filter(Boolean);
          }
        } else {
          importedNames = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        }

        if (importedNames.length === 0) {
          setImportStatus('No valid player usernames found in file.');
          setIsImporting(false);
          return;
        }

        let count = 0;
        for (const name of importedNames) {
          await fetch(`${API_BASE}/server/players/${activeList}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', name })
          });
          count++;
        }

        setImportStatus(`Successfully imported ${count} player(s) to ${activeList}!`);
        setTimeout(() => loadList(activeList!), 1200);
      } catch (err) {
        setImportStatus('Error parsing file. Please provide a valid JSON array or text list.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Autocomplete Suggestions logic
  const filteredSuggestions = inputName.trim()
    ? allKnownPlayers.filter(p => p.name.toLowerCase().includes(inputName.toLowerCase()))
    : [];

  const getListTheme = (type: string) => {
    if (type === 'ops') return {
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      bannerBg: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
      iconColor: 'text-purple-400',
      addBtn: 'bg-purple-600 hover:bg-purple-500',
      title: 'Operator & Admin Privileges Policy',
      desc: 'Server operators (OPs) are granted full in-game administrative commands (game modes, /op, /stop, item spawning, and ban control). Only grant OP status to trusted server administrators.'
    };
    if (type === 'banned-players') return {
      badge: 'bg-red-500/20 text-red-300 border-red-500/30',
      bannerBg: 'bg-red-500/10 border-red-500/30 text-red-300',
      iconColor: 'text-red-400',
      addBtn: 'bg-red-600 hover:bg-red-500',
      title: 'Banned Players Security Policy',
      desc: 'Banned players are permanently blocked from joining craft.neopix.in. Access is automatically revoked across all client IP addresses and player UUIDs upon banning.'
    };
    return {
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      bannerBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      iconColor: 'text-amber-400',
      addBtn: 'bg-amber-600 hover:bg-amber-500',
      title: 'Whitelist Protection Policy',
      desc: 'When whitelist is enabled on your server, only players on this list will be allowed to join. Any player not found on this whitelist will be automatically blocked from connecting.'
    };
  };

  if (activeList) {
    const theme = getListTheme(activeList);
    const Icon = activeList === 'ops' ? Users : activeList === 'banned-players' ? XCircle : ShieldCheck;

    const displayList = players.filter((p: any) => {
      const name = typeof p === 'string' ? p : p.name || '';
      return name.toLowerCase().includes(filterQuery.toLowerCase());
    });

    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-6">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#2d3847]">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setActiveList(null)} 
              className="px-3.5 py-2 bg-[#1c222b] hover:bg-[#28313e] border border-[#2d3847] rounded-sm text-gray-300 hover:text-white font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <CornerUpLeft size={16} />
              <span>Back</span>
            </button>
            <h2 className="text-2xl font-extrabold text-white capitalize tracking-wide">
              {activeList.replace('-', ' ')}
            </h2>
            <span className={`border px-2.5 py-0.5 rounded text-xs font-mono font-bold ${theme.badge}`}>
              {players.length} Players
            </span>
          </div>

          {/* Export & Import Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportList}
              disabled={players.length === 0}
              className="px-3.5 py-2 bg-[#1c222b] hover:bg-[#28313e] disabled:opacity-40 border border-[#2d3847] rounded-sm text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Export player list as JSON file"
            >
              <Download size={15} />
              <span>Export List</span>
            </button>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportFile} 
              accept=".json,.txt" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className={`px-3.5 py-2 ${theme.addBtn} disabled:opacity-50 rounded-sm text-white font-bold text-xs flex items-center space-x-1.5 shadow transition-colors cursor-pointer`}
              title="Import players from JSON or TXT file"
            >
              <Upload size={15} />
              <span>{isImporting ? 'Importing...' : 'Import List'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Status / Enforcement Policy Banner */}
        <div className={`p-4 rounded-sm text-xs leading-relaxed flex items-start space-x-3 border ${theme.bannerBg}`}>
          <Icon size={20} className={`${theme.iconColor} flex-shrink-0 mt-0.5`} />
          <div>
            <strong className="block text-sm mb-0.5 font-bold">{theme.title}</strong>
            {theme.desc}
          </div>
        </div>

        {/* Import Status Feedback Notification */}
        {importStatus && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-sm text-emerald-400 text-xs font-mono font-bold flex items-center justify-between">
            <span>{importStatus}</span>
            <button onClick={() => setImportStatus(null)} className="text-gray-400 hover:text-white text-xs cursor-pointer">✕</button>
          </div>
        )}

        {/* Add Player Input with Smart Autocomplete Suggestions */}
        <div className="relative">
          <form onSubmit={(e) => { e.preventDefault(); addPlayer(); }} className="flex space-x-2">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder={`Add player to ${activeList.replace('-', ' ')} (e.g. CryoSync, Notch)...`} 
                value={inputName} 
                onChange={e => {
                  setInputName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full px-4 py-3 rounded-sm bg-[#12161c] border border-[#2d3847] text-white placeholder:text-gray-600 focus:border-blue-500 outline-none font-mono text-sm shadow-inner"
              />

              {/* Autocomplete Dropdown Menu */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute left-0 right-0 top-full mt-1 bg-[#1c222b] border border-[#2d3847] rounded-sm shadow-2xl z-50 max-h-56 overflow-y-auto"
                >
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-500 border-b border-[#2d3847] bg-[#181d24]">
                    Suggested Known Players
                  </div>
                  {filteredSuggestions.map((p) => (
                    <div
                      key={p.name}
                      onClick={() => {
                        setInputName(p.name);
                        setShowSuggestions(false);
                      }}
                      className="px-3.5 py-2 hover:bg-blue-600/20 flex items-center justify-between cursor-pointer border-b border-[#2d3847]/50 last:border-0 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5">
                        <img 
                          src={`https://minotar.net/helm/${p.name}/24.png`} 
                          alt={p.name} 
                          className="w-6 h-6 rounded object-cover border border-[#2d3847]"
                          onError={(e: any) => { e.target.src = 'https://minotar.net/helm/Steve/24.png'; }}
                        />
                        <span className="font-mono text-xs font-bold text-gray-200">{p.name}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        p.online ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700/50 text-gray-400'
                      }`}>
                        {p.online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={!inputName.trim()}
              className={`px-6 py-3 ${theme.addBtn} disabled:opacity-50 text-white rounded-sm font-bold text-sm shadow transition-all cursor-pointer flex items-center space-x-1.5 flex-shrink-0`}
            >
              <Plus size={16} />
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* Search Filter for Current List */}
        {players.length > 5 && (
          <div className="relative">
            <input 
              type="text" 
              placeholder={`Search in ${activeList}...`} 
              value={filterQuery} 
              onChange={e => setFilterQuery(e.target.value)}
              className="w-full px-4 py-2 pl-9 bg-[#1c222b] border border-[#2d3847] rounded-sm text-xs text-white placeholder:text-gray-500 outline-none focus:border-blue-500"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
          </div>
        )}

        {/* Players List Table */}
        <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm overflow-hidden shadow-xl">
          {displayList.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-mono text-sm space-y-2">
              <UserX size={36} className="mx-auto text-gray-600 mb-2" />
              <div>No players found in this list.</div>
              <p className="text-xs text-gray-600">Type a username above to add players to {activeList}, or import a player list.</p>
            </div>
          ) : (
            displayList.map((p: any, i: number) => {
              const playerName = typeof p === 'string' ? p : p.name || p.username;
              return (
                <div key={i} className="flex items-center justify-between p-3.5 border-b border-[#2d3847] last:border-0 hover:bg-[#222934] transition-colors select-none">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={`https://minotar.net/helm/${playerName}/32.png`} 
                      alt={playerName} 
                      className="w-8 h-8 rounded object-cover border border-[#2d3847]"
                      onError={(e: any) => { e.target.src = 'https://minotar.net/helm/Steve/32.png'; }}
                    />
                    <span className="font-mono text-sm font-bold text-white">{playerName}</span>
                  </div>

                  <button 
                    onClick={() => removePlayer(playerName)} 
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-sm font-bold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                    title={`Remove ${playerName} from ${activeList}`}
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const lists = [
    { id: 'whitelist', name: 'Whitelist', desc: 'Players allowed to join when whitelist is enabled.', icon: ShieldCheck },
    { id: 'ops', name: 'OPs (Admins)', desc: 'Players with operator (admin) commands.', icon: Users },
    { id: 'banned-players', name: 'Banned Players', desc: 'Players completely blocked from joining.', icon: XCircle }
  ] as const;

  if (selectedPlayer) {
    return <PlayerDetails token={token} playerName={selectedPlayer.name} isOnline={selectedPlayer.online} onBack={() => setSelectedPlayer(null)} />;
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {lists.map(list => {
            const Icon = list.icon;
            return (
              <button key={list.id} onClick={() => loadList(list.id)} className="bg-[#2b2b36] hover:bg-[#3e3e4a] border border-[#3e3e4a] rounded p-6 text-left transition-colors group">
                <Icon size={32} className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-bold text-white mb-2">{list.name}</h3>
                <p className="text-sm text-gray-400">{list.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Players Overview</h2>
        {allKnownPlayers.length === 0 ? (
          <div className="p-8 bg-[#2b2b36] border border-[#3e3e4a] rounded text-center text-gray-400">
            No players have joined the server yet.
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {allKnownPlayers.map(p => (
              <div 
                key={p.name} 
                onClick={() => setSelectedPlayer(p)}
                className={`flex items-center justify-between p-4 rounded-xl border-2 bg-[#2b2b36] transition-all cursor-pointer hover:bg-[#333b43] ${p.online ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-[#3e3e4a]'}`}
              >
                
                <div className="flex items-center">
                  <div className="relative">
                    <img src={`https://minotar.net/armor/bust/${p.name}/40.png`} alt={p.name} className="w-10 h-10 rounded shadow-sm object-cover" />
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#2b2b36] ${p.online ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-gray-500'}`} />
                  </div>
                  <span className="font-bold text-gray-100 ml-4 text-lg">{p.name}</span>
                </div>

                  <div className="flex items-center space-x-3">
                   <button 
                     onClick={(e) => { e.stopPropagation(); quickAction('whitelist', p.isWhitelisted ? 'remove' : 'add', p.name); }}
                     className={`px-4 py-2 rounded text-sm font-bold transition-colors ${p.isWhitelisted ? 'bg-blue-600 text-white shadow-lg' : 'bg-[#3e3e4a] text-gray-300 hover:bg-[#4a4a5a]'}`}
                   >
                     {p.isWhitelisted ? 'Whitelisted' : 'Whitelist'}
                   </button>

                   <button 
                     onClick={(e) => { e.stopPropagation(); quickAction('ops', p.isOp ? 'remove' : 'add', p.name); }}
                     className={`px-4 py-2 rounded text-sm font-bold transition-colors ${p.isOp ? 'bg-purple-600 text-white shadow-lg' : 'bg-[#3e3e4a] text-gray-300 hover:bg-[#4a4a5a]'}`}
                   >
                     {p.isOp ? 'Deop' : 'Make OP'}
                   </button>

                   <button 
                     onClick={(e) => { e.stopPropagation(); quickAction('banned-players', p.isBanned ? 'remove' : 'add', p.name); }}
                     className={`px-4 py-2 rounded text-sm font-bold transition-colors ${p.isBanned ? 'bg-red-600 text-white shadow-lg' : 'bg-[#3e3e4a] text-gray-300 hover:bg-[#4a4a5a]'}`}
                   >
                     {p.isBanned ? 'Unban' : 'Ban'}
                   </button>

                     {p.online && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); kickPlayer(p.name); }}
                         className="px-4 py-2 rounded text-sm font-bold bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 transition-colors"
                       >
                         Kick
                       </button>
                     )}
                  </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderColorfulMessage(msg: string) {
  const tokenRegex = /(https?:\/\/[^\s]+|\[[^\]]+\]|\b(?:joined the game|left the game|logged in|disconnected)\b|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b|\b\d+(?:\.\d+)?[a-z]*\b)/gi;

  const parts = msg.split(tokenRegex);

  return parts.map((part, i) => {
    if (!part) return null;

    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer" className="text-cyan-300 underline hover:text-cyan-200">
          {part}
        </a>
      );
    }

    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span key={i} className="text-sky-300 font-semibold">
          {part}
        </span>
      );
    }

    if (/^(joined the game|logged in)$/i.test(part)) {
      return <span key={i} className="text-emerald-400 font-bold">{part}</span>;
    }

    if (/^(left the game|disconnected)$/i.test(part)) {
      return <span key={i} className="text-rose-400 font-bold">{part}</span>;
    }

    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(part)) {
      return <span key={i} className="text-pink-300 font-mono text-xs">{part}</span>;
    }

    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(part)) {
      return <span key={i} className="text-purple-300 font-mono font-bold">{part}</span>;
    }

    if (/^\d+(?:\.\d+)?[a-z]*$/i.test(part)) {
      return <span key={i} className="text-amber-300 font-mono font-semibold">{part}</span>;
    }

    return <span key={i}>{part}</span>;
  });
}

function parseLogLine(line: string, index: number) {
  const cleanLine = line.replace(/\u001b\[[0-9;]*m/g, '');

  const logRegex = /^\[(\d{2}:\d{2}:\d{2})\]\s+\[([^/]+)\/([A-Z]+)\]:\s*(.*)$/;
  const match = cleanLine.match(logRegex);

  if (!match) {
    let colorClass = 'text-gray-300';
    if (cleanLine.includes('Error') || cleanLine.includes('Exception') || cleanLine.trim().startsWith('at ')) {
      colorClass = 'text-red-400 font-bold';
    } else if (cleanLine.includes('WARN') || cleanLine.includes('Warning')) {
      colorClass = 'text-amber-300 font-semibold';
    }
    return (
      <div key={index} className={`py-0.5 px-2 font-mono text-xs break-all hover:bg-[#252530] ${colorClass}`}>
        {renderColorfulMessage(cleanLine)}
      </div>
    );
  }

  const [, time, thread, level, msg] = match;

  let levelBadge = <span className="text-emerald-400 font-bold">INFO</span>;

  if (level === 'WARN' || level === 'WARNING') {
    levelBadge = <span className="text-amber-300 font-bold">WARN</span>;
  } else if (level === 'ERROR' || level === 'FATAL' || level === 'SEVERE') {
    levelBadge = <span className="text-red-400 font-bold">ERROR</span>;
  }

  return (
    <div key={index} className="py-0.5 px-2 hover:bg-[#252530] transition-colors flex flex-wrap items-baseline gap-1.5 font-mono text-xs">
      <span className="text-sky-400 font-medium">[{time}]</span>
      <span className="text-gray-400">
        [<span className="text-purple-300 font-medium">{thread}</span>/{levelBadge}]:
      </span>
      <span className="text-gray-200 break-all flex-1 leading-relaxed">
        {renderColorfulMessage(msg)}
      </span>
    </div>
  );
}

function LogTab({ token }: { token: string }) {
  const [logText, setLogText] = useState('');
  const [loading, setLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/server/log`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setLogText(data.content);
      } else {
        setLogText('No latest.log file found.');
      }
    } catch (e) {
      setLogText('Failed to load log.');
    }
    setLoading(false);
  };

  const clearLog = async () => {
    if (!confirm('Are you sure you want to clear the latest.log file?')) return;
    try {
      await fetch(`${API_BASE}/server/log/clear`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      setLogText('');
    } catch (e) {
      alert('Failed to clear log.');
    }
  };

  useEffect(() => { fetchLog(); }, []);

  useEffect(() => {
    if (!loading) {
      logEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [logText, loading]);

  const lines = logText.split('\n').filter(Boolean);

  return (
    <div className="space-y-4 flex flex-col h-[85vh]">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-white">latest.log</h2>
        <div className="flex space-x-2">
          <button onClick={clearLog} className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-colors rounded font-medium border border-red-500/30">Clear Log</button>
          <button onClick={fetchLog} className="px-4 py-2 bg-[#2b2b36] hover:bg-[#3e3e4a] rounded text-white font-medium">Refresh Log</button>
        </div>
      </div>
      <div className="flex-1 bg-[#1e1e24] border border-[#3e3e4a] rounded overflow-y-auto p-4 leading-relaxed">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading log file...</div>
        ) : lines.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Log file is empty.</div>
        ) : (
          <div>
            {lines.map((line, idx) => parseLogLine(line, idx))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function PluginsTab({ token }: { token: string }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('/plugins');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/server/files?path=${encodeURIComponent(path)}`, { headers: { 'Authorization': `Bearer ${token}` }});
      const data = await res.json();
      if (data.success) {
        const sorted = data.files.sort((a: any, b: any) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(sorted);
        setCurrentPath(path);
      }
    } catch (e) { }
    setLoading(false);
    setSelectedFiles([]);
  };

  useEffect(() => { loadFiles('/plugins'); }, []);

  const navigateUp = () => {
    if (currentPath === '/plugins' || currentPath === '/plugins/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    let newPath = '/' + parts.join('/');
    if (!newPath.startsWith('/plugins')) newPath = '/plugins';
    loadFiles(newPath);
  };

  const navigateTo = (name: string) => {
    const p = currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name;
    loadFiles(p);
  };

  const toggleSelection = (name: string) => {
    setSelectedFiles(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const toggleAll = () => {
    if (selectedFiles.length === files.length && files.length > 0) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.name));
    }
  };

  const deleteSelected = async () => {
    if (selectedFiles.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedFiles.length} item(s)?`)) return;
    
    setLoading(true);
    try {
      await fetch(`${API_BASE}/server/files/delete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: selectedFiles, basePath: currentPath })
      });
    } catch (e) { }
    loadFiles(currentPath);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath);
    formData.append('basePath', currentPath);

    try {
      await fetch(`${API_BASE}/server/files/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
    } catch (e) { }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    loadFiles(currentPath);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const m = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    let hr = d.getHours();
    const ampm = hr >= 12 ? 'PM' : 'AM';
    hr = hr % 12;
    hr = hr ? hr : 12;
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${m} ${day}, ${hr}:${min} ${ampm}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-[#8fa3b0] uppercase tracking-widest">Plugins</h2>
        {currentPath !== '/plugins' && currentPath !== '/plugins/' && (
           <div className="flex items-center text-gray-400 cursor-pointer hover:text-white transition-colors bg-[#2b2b36] px-3 py-1.5 rounded" onClick={navigateUp}>
             <CornerUpLeft size={18} className="mr-2" />
             <span className="font-mono text-sm">{currentPath}</span>
           </div>
        )}
      </div>
      <div className="bg-[#1e1e24] border border-[#3e3e4a] rounded shadow-sm">
        <div className="flex items-center px-4 py-3 border-b border-[#3e3e4a] text-gray-400 space-x-6">
           <input 
             type="file" 
             className="hidden" 
             ref={fileInputRef} 
             onChange={handleUpload} 
             disabled={loading}
           />
           <button 
             type="button" 
             onClick={() => fileInputRef.current?.click()} 
             className="hover:text-white transition-colors flex items-center cursor-pointer bg-transparent border-0 p-0 text-gray-400 outline-none"
             title="Upload File / Plugin"
           >
             <CloudUpload size={20} />
           </button>
           <div className="w-px h-5 bg-[#3e3e4a]"></div>
           <button 
             type="button"
             disabled={selectedFiles.length === 0}
             onClick={selectedFiles.length > 0 ? deleteSelected : undefined}
             className={`transition-colors bg-transparent border-0 p-0 outline-none ${selectedFiles.length > 0 ? 'text-gray-400 hover:text-red-400 cursor-pointer' : 'text-gray-600 opacity-50 cursor-not-allowed'}`}
             title="Delete Selected"
           >
             <Trash2 size={20} />
           </button>
           <div className="w-px h-5 bg-[#3e3e4a]"></div>
           <button 
             type="button" 
             onClick={() => loadFiles(currentPath)} 
             className="hover:text-white transition-colors flex items-center cursor-pointer bg-transparent border-0 p-0 text-gray-400 outline-none"
             title="Refresh"
           >
             <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
        
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-[#3e3e4a] text-xs font-bold text-[#8fa3b0] uppercase tracking-wider">
           <div className="col-span-6 flex items-center">
             <input 
               type="checkbox" 
               className="mr-4 w-4 h-4 bg-[#2b2b36] border-[#3e3e4a] rounded cursor-pointer" 
               checked={files.length > 0 && selectedFiles.length === files.length}
               onChange={toggleAll}
             />
             NAME
           </div>
           <div className="col-span-2">TYPE</div>
           <div className="col-span-2">SIZE</div>
           <div className="col-span-2 text-right pr-4">LAST MODIFIED</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Directory is empty.</div>
        ) : (
          <div className="flex flex-col">
            {files.map((f, i) => (
              <div key={i} className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-[#3e3e4a] last:border-0 transition-colors items-center group text-sm text-[#c0cad2] ${selectedFiles.includes(f.name) ? 'bg-[#3e3e4a]/50' : 'hover:bg-[#2b2b36]'}`}>
                 <div className="col-span-6 flex items-center">
                    <input 
                      type="checkbox" 
                      className="mr-4 w-4 h-4 bg-[#2b2b36] border-[#3e3e4a] rounded cursor-pointer opacity-100 transition-opacity" 
                      checked={selectedFiles.includes(f.name)}
                      onChange={() => toggleSelection(f.name)}
                    />
                    {f.isDirectory ? (
                      <Folder size={18} className="mr-3 text-[#ffb74d] fill-current" />
                    ) : (
                      <FileIcon size={18} className="mr-3 text-gray-400" />
                    )}
                    <span 
                      className={`truncate ${f.isDirectory ? 'cursor-pointer hover:text-white font-medium' : 'cursor-pointer hover:text-white'}`}
                      onClick={() => f.isDirectory ? navigateTo(f.name) : toggleSelection(f.name)}
                    >
                      {f.name}
                    </span>
                 </div>
                 <div className="col-span-2 text-[#7b8f9e]">{f.isDirectory ? 'Directory' : (f.name.endsWith('.jar') ? 'Java Archive' : 'File')}</div>
                 <div className="col-span-2 text-[#7b8f9e]">{f.isDirectory ? '-' : formatSize(f.size)}</div>
                 <div className="col-span-2 text-right pr-4 text-[#7b8f9e]">
                    {formatDate(f.modifiedAt)}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BackupsTab({ token }: { token: string }) {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);

  const loadBackups = async () => {
    const res = await fetch(`${API_BASE}/server/backups`, { headers: { 'Authorization': `Bearer ${token}` }});
    const data = await res.json();
    if (data.success) setBackups(data.backups);
  };

  useEffect(() => { loadBackups(); }, []);

  const createBackup = async () => {
    setLoading(true);
    await fetch(`${API_BASE}/server/backups/create`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
    setLoading(false);
    loadBackups();
    alert('Backup created successfully in backups/ folder!');
  };

  const restoreBackup = (name: string) => {
    setRestoringBackup(name);
  };

  const confirmRestore = async () => {
    if (!restoringBackup) return;
    setLoading(true);
    await fetch(`${API_BASE}/server/backups/restore`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: restoringBackup }) });
    setLoading(false);
    setRestoringBackup(null);
    alert('Backup restored! Server is restarting.');
  };

  const deleteBackup = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete backup ${name}?`)) return;
    setLoading(true);
    await fetch(`${API_BASE}/server/backups/delete`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setLoading(false);
    loadBackups();
  };

  return (
    <div className="space-y-6">
      {restoringBackup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1e24] border border-[#3e3e4a] rounded-lg p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-red-500 mb-2">WARNING: Overwrite World</h3>
            <p className="text-gray-300 mb-4 text-sm leading-relaxed">
              You are about to restore <strong>{restoringBackup}</strong>. This will permanently overwrite your current world. 
              <br/><br/>
              <strong className="text-red-400">CRITICAL: The server MUST BE OFF before you proceed!</strong> If the server is running, world corruption may occur.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setRestoringBackup(null)} disabled={loading} className="px-4 py-2 bg-[#2b2b36] hover:bg-[#3e3e4a] border border-[#3e3e4a] text-white rounded transition-colors text-sm font-bold disabled:opacity-50">Cancel</button>
              <button onClick={confirmRestore} disabled={loading} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors text-sm font-bold">
                {loading ? 'Restoring...' : 'I understand, Restore Backup'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Backups</h2>
          <p className="text-gray-400 text-sm">Securely compress your world data into a zip file.</p>
        </div>
        <button 
          onClick={createBackup} 
          disabled={loading}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold disabled:opacity-50 transition-colors shadow-lg"
        >
          {loading ? 'Compressing Worlds...' : 'Create Backup Now'}
        </button>
      </div>

      <div className="bg-[#2b2b36] border border-[#3e3e4a] rounded overflow-hidden">
        {backups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No backups found.</div>
        ) : (
          backups.map((b, i) => (
            <div 
              key={i} 
              className="flex items-center justify-between p-4 border-b border-[#3e3e4a] last:border-0 hover:bg-[#1e1e24] transition-colors cursor-pointer group"
              onClick={() => restoreBackup(b.name)}
            >
              <div className="flex items-center">
                <Save size={24} className="text-emerald-500 mr-4" />
                <div>
                  <span className="font-medium text-white block group-hover:text-blue-400 transition-colors">
                    {b.name}
                  </span>
                  <span className="text-sm text-gray-400">{(b.size / 1024 / 1024).toFixed(2)} MB • {new Date(b.date).toLocaleString()}</span>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteBackup(b.name); }} 
                disabled={loading} 
                className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                title="Delete Backup"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MapTab(_props: any) {
  return (
    <div className="flex-1 w-full relative bg-[#1a1a20]">
      <iframe 
        src={`http://${window.location.hostname}:8100`} 
        className="absolute inset-0 w-full h-full border-0 block" 
        title="3D Minecraft Map"
      />
    </div>
  );
}
