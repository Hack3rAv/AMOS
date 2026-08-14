import { useState, useEffect, useRef } from 'react';
import { 
  Swords, Trophy, Plus, Users, UserCheck, 
  Globe, Megaphone, Trash2, History, Link, ShieldCheck
} from 'lucide-react';

const API_BASE = `${window.location.protocol}//${window.location.host}/api`;

interface ActiveEvent {
  id: string;
  title: string;
  mode: string;
  arenaEnv: string;
  dimension: string;
  startTime: string;
  teams: { name: string; color: string; members: string[] }[];
  players: string[];
  status: string;
}

interface EventHistoryItem {
  id: string;
  title: string;
  mode: string;
  winner: string;
  date: string;
  arena: string;
}

interface EventsTabProps {
  token: string;
}

interface KnownPlayer {
  name: string;
  online: boolean;
}

const KNOWN_PLAYERS: KnownPlayer[] = [
  { name: 'CryoSync', online: true },
  { name: 'Alex', online: true },
  { name: 'Steve', online: false },
  { name: 'Notch', online: false },
  { name: 'Dinnerbone', online: false },
  { name: 'Grumm', online: false },
  { name: 'Herobrine', online: false }
];

function PlayerAutocompleteInput({ 
  value, 
  onChange, 
  placeholder, 
  isMulti = false,
  token,
  position = 'top'
}: { 
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string;
  isMulti?: boolean;
  token?: string;
  position?: 'top' | 'bottom';
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [onlineList, setOnlineList] = useState<KnownPlayer[]>(KNOWN_PLAYERS.filter(p => p.online));
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/server/players/online`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.players) && data.players.length > 0) {
          setOnlineList(data.players.map((p: any) => ({ name: typeof p === 'string' ? p : p.name, online: true })));
        } else {
          setOnlineList(KNOWN_PLAYERS.filter(p => p.online));
        }
      })
      .catch(() => {
        setOnlineList(KNOWN_PLAYERS.filter(p => p.online));
      });
  }, [token]);

  const currentQuery = isMulti 
    ? value.split(',').pop()?.trim() || ''
    : value.trim();

  // STACK FILTER: Strictly ONLY online players
  const filtered = onlineList.filter(p => 
    p.online && (currentQuery === '' || p.name.toLowerCase().includes(currentQuery.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (playerName: string) => {
    if (isMulti) {
      const parts = value.split(',').map(s => s.trim()).filter(Boolean);
      parts.pop();
      parts.push(playerName);
      onChange(parts.join(', ') + ', ');
    } else {
      onChange(playerName);
    }
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onFocus={() => setShowSuggestions(true)}
        onChange={e => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        className="w-full p-2 bg-[#1c222b] border border-[#2d3847] rounded text-white outline-none focus:border-emerald-400 font-mono text-xs shadow-inner"
      />

      {showSuggestions && filtered.length > 0 && (
        <div className={`absolute left-0 right-0 bg-[#1c222b] border-2 border-emerald-500/60 rounded-md shadow-[0_0_30px_rgba(0,0,0,0.95)] z-[9999] max-h-56 overflow-y-auto ${
          position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-[#12161c] border-b border-[#2d3847] font-bold flex items-center justify-between sticky top-0 z-10">
            <span>Select Online Player</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          {filtered.map(p => (
            <div
              key={p.name}
              onClick={() => handleSelect(p.name)}
              className="px-3 py-2 hover:bg-emerald-500/20 flex items-center justify-between cursor-pointer border-b border-[#2d3847]/60 last:border-0 transition-colors bg-[#1c222b]"
            >
              <div className="flex items-center space-x-2.5">
                <img 
                  src={`https://minotar.net/helm/${p.name}/24.png`} 
                  alt={p.name} 
                  className="w-6 h-6 rounded object-cover border border-[#2d3847] shadow"
                  onError={(e: any) => { e.target.src = 'https://minotar.net/helm/Steve/24.png'; }}
                />
                <span className="font-mono text-xs font-bold text-white tracking-wide">{p.name}</span>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                ONLINE
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EventsTab({ token }: EventsTabProps) {
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const [history, setHistory] = useState<EventHistoryItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRegInfoModal, setShowRegInfoModal] = useState(false);

  // Form State for Event Creation
  const [eventTitle, setEventTitle] = useState('');
  const [eventMode, setEventMode] = useState<'1v1 Duel' | 'Multiplayer FFA' | '2-Team Battle' | 'Multi-Team Battle'>('1v1 Duel');
  const [arenaEnv, setArenaEnv] = useState<'flat' | 'normal' | 'nether' | 'the_end'>('flat');
  
  // Players for 1v1 / FFA
  const [player1, setPlayer1] = useState('CryoSync');
  const [player2, setPlayer2] = useState('Alex');
  const [ffaPlayers, setFfaPlayers] = useState('CryoSync, Alex, Steve, Notch');

  // Teams for Team Battles
  const [team1Name, setTeam1Name] = useState('Red Dragons');
  const [team1Members, setTeam1Members] = useState('CryoSync, Alex');
  const [team2Name, setTeam2Name] = useState('Blue Knights');
  const [team2Members, setTeam2Members] = useState('Steve, Notch');

  // Announcement State
  const [customBroadcast, setCustomBroadcast] = useState('');
  const [selectedWinner, setSelectedWinner] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/server/events/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActiveEvent(data.activeEvent);
        setHistory(data.history || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const handleStartEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    let teams: any[] = [];
    let players: string[] = [];

    if (eventMode === '1v1 Duel') {
      players = [player1.trim(), player2.trim()].filter(Boolean);
    } else if (eventMode === 'Multiplayer FFA') {
      players = ffaPlayers.split(',').map(s => s.trim()).filter(Boolean);
    } else if (eventMode === '2-Team Battle' || eventMode === 'Multi-Team Battle') {
      const t1M = team1Members.split(',').map(s => s.trim()).filter(Boolean);
      const t2M = team2Members.split(',').map(s => s.trim()).filter(Boolean);
      teams = [
        { name: team1Name || 'Red Team', color: 'red', members: t1M },
        { name: team2Name || 'Blue Team', color: 'blue', members: t2M }
      ];
      players = [...t1M, ...t2M];
    }

    const fallbackEvent: ActiveEvent = {
      id: Date.now().toString(),
      title: eventTitle,
      mode: eventMode,
      arenaEnv,
      dimension: `arena_${eventTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      startTime: new Date().toLocaleTimeString(),
      teams,
      players,
      status: 'active'
    };

    setActiveEvent(fallbackEvent);
    setShowCreateModal(false);

    try {
      const res = await fetch(`${API_BASE}/server/events/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventTitle,
          mode: eventMode,
          arenaEnv,
          teams,
          players
        })
      });
      const data = await res.json();
      if (data.success && data.activeEvent) {
        setActiveEvent(data.activeEvent);
      }
    } catch (e) {}

    setEventTitle('');
  };

  const handleAnnounce = async (message?: string, title?: string, subtitle?: string) => {
    try {
      await fetch(`${API_BASE}/server/events/announce`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message || customBroadcast,
          title,
          subtitle
        })
      });
      setCustomBroadcast('');
    } catch (e) {}
  };

  const handleEndEvent = async () => {
    if (!confirm('Are you sure you want to end this event? All players will be warped to overworld spawn and the arena dimension will be DESTROYED!')) return;

    const winner = selectedWinner || 'Tournament Champions';
    const newHistoryItem: EventHistoryItem = {
      id: Date.now().toString(),
      title: activeEvent?.title || 'Tournament',
      mode: activeEvent?.mode || 'PvP Duel',
      winner: winner,
      date: new Date().toLocaleDateString(),
      arena: activeEvent?.dimension || 'arena_disposable'
    };

    setHistory(prev => [newHistoryItem, ...prev]);
    setActiveEvent(null);
    setSelectedWinner('');

    try {
      await fetch(`${API_BASE}/server/events/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerName: winner,
          winnerType: (activeEvent?.mode || '').includes('Team') ? 'Team' : 'Player'
        })
      });
    } catch (e) {}
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full pb-8">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-3 border-b border-[#2d3847] gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow">
            <Swords size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-wide flex items-center space-x-2">
              <span>Events & Tournaments</span>
              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                PvP & Teams Engine
              </span>
            </h2>
            <div className="text-xs text-gray-400">Organize 1v1 duels, multiplayer FFAs & team battles with disposable arenas</div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowRegInfoModal(true)}
            className="px-3 py-1.5 bg-[#1c222b] hover:bg-[#28313e] border border-[#2d3847] text-gray-300 hover:text-white font-bold text-xs rounded flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Link size={14} className="text-blue-400" />
            <span>Registration Info</span>
          </button>
          
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded shadow transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>Organize Event</span>
          </button>
        </div>
      </div>

      {/* ACTIVE EVENT DASHBOARD (If an event is live) */}
      {activeEvent ? (
        <div className="bg-[#1c222b] border-2 border-amber-500/50 rounded-sm p-4 space-y-4 shadow-2xl relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-3 border-b border-[#2d3847] gap-2">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                <h3 className="text-xl font-extrabold text-white tracking-wide">{activeEvent.title}</h3>
                <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold rounded">
                  {activeEvent.mode}
                </span>
              </div>
              <div className="text-xs font-mono text-gray-400 mt-1 flex items-center space-x-3">
                <span>Arena: <strong className="text-emerald-400">{activeEvent.dimension}</strong></span>
                <span>Started at: <strong className="text-white">{activeEvent.startTime}</strong></span>
                <span className="text-purple-300 font-bold flex items-center space-x-1">
                  <ShieldCheck size={14} />
                  <span>Friendly Fire: OFF</span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button 
                onClick={handleEndEvent}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded shadow transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 size={14} />
                <span>End & Destroy Arena</span>
              </button>
            </div>
          </div>

          {/* Active Roster & Team Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#12161c] border border-[#2d3847] p-3 rounded space-y-2">
              <div className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Users size={14} className="text-blue-400" />
                <span>Registered Participants ({activeEvent.players.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeEvent.players.map((p) => (
                  <span key={p} className="px-2.5 py-1 bg-[#1c222b] border border-[#2d3847] text-white text-xs font-mono font-bold rounded flex items-center space-x-1">
                    <img 
                      src={`https://minotar.net/helm/${p}/16.png`} 
                      alt={p} 
                      className="w-4 h-4 rounded object-cover"
                      onError={(e: any) => { e.target.src = 'https://minotar.net/helm/Steve/16.png'; }}
                    />
                    <span>{p}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* In-Game Announcements Bar */}
            <div className="bg-[#12161c] border border-[#2d3847] p-3 rounded space-y-2">
              <div className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Megaphone size={14} className="text-amber-400" />
                <span>Live Admin In-Game Announcements</span>
              </div>

              <div className="flex space-x-1.5">
                <button 
                  onClick={() => handleAnnounce(undefined, '⚔️ MATCH STARTED!', 'Get ready to fight!')}
                  className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-300 text-[11px] font-bold rounded cursor-pointer"
                >
                  📢 Match Start
                </button>
                <button 
                  onClick={() => handleAnnounce(undefined, '🔥 FINAL DUEL!', 'Last 2 combatants standing!')}
                  className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-300 text-[11px] font-bold rounded cursor-pointer"
                >
                  ⚔️ Final Duel
                </button>
              </div>

              <div className="flex space-x-2 pt-1">
                <input 
                  type="text"
                  placeholder="Type custom match broadcast..."
                  value={customBroadcast}
                  onChange={e => setCustomBroadcast(e.target.value)}
                  className="flex-1 bg-[#1c222b] border border-[#2d3847] px-2.5 py-1 text-xs text-white outline-none rounded font-mono"
                />
                <button 
                  onClick={() => handleAnnounce()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded cursor-pointer"
                >
                  Broadcast
                </button>
              </div>
            </div>
          </div>

          {/* Winner Selector before destruction */}
          <div className="bg-[#12161c] border border-emerald-500/40 p-3 rounded flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-gray-300">
              <Trophy size={16} className="text-amber-400" />
              <span>Select Match Winner (for Leaderboard):</span>
            </div>
            <div className="flex items-center space-x-2">
              <PlayerAutocompleteInput 
                value={selectedWinner}
                onChange={setSelectedWinner}
                placeholder="Winner / Team Name"
                token={token}
              />
              <button 
                onClick={handleEndEvent}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded cursor-pointer whitespace-nowrap"
              >
                Declare Winner & End
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-6 text-center space-y-3 shadow-md">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <Trophy size={24} />
          </div>
          <h3 className="text-lg font-bold text-white">No Event Currently Active</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            Organize a 1v1 duel, multiplayer FFA, or team battle. Starting an event will automatically create a temporary disposable arena dimension!
          </p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded shadow transition-all cursor-pointer inline-flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Organize Event Now</span>
          </button>
        </div>
      )}

      {/* EVENT HISTORY & LEADERBOARD TABLE */}
      <div className="bg-[#1c222b] border border-[#2d3847] rounded-sm p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#2d3847] pb-2">
          <div className="flex items-center space-x-2 text-white font-extrabold text-base">
            <History className="text-amber-400" size={18} />
            <span>Tournament History & Leaderboard</span>
          </div>
          <span className="text-xs text-gray-400 font-mono">{history.length} Matches Logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-[#12161c] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#2d3847]">
                <th className="p-2.5">Event Title</th>
                <th className="p-2.5">Mode</th>
                <th className="p-2.5">Winner / Champions</th>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Arena Dimension</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3847]">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-[#252d3a] transition-colors">
                  <td className="p-2.5 font-bold text-white">{h.title}</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded text-[10px] font-bold">
                      {h.mode}
                    </span>
                  </td>
                  <td className="p-2.5 font-bold text-amber-400 flex items-center space-x-1">
                    <Trophy size={13} />
                    <span>{h.winner}</span>
                  </td>
                  <td className="p-2.5 text-gray-400">{h.date}</td>
                  <td className="p-2.5 text-emerald-400 text-[10px]">{h.arena} (Destroyed)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ORGANIZE EVENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1c222b] rounded-sm shadow-2xl border border-[#2d3847] w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-emerald-600 text-white p-3.5 font-bold flex justify-between items-center select-none">
              <div className="flex items-center space-x-2">
                <Swords size={18} />
                <span className="text-sm tracking-wide">Organize PvP / Team Battle Event</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-white hover:text-gray-200 font-bold">✕</button>
            </div>

            <form onSubmit={handleStartEvent} className="p-4 bg-[#12161c] space-y-4 font-mono text-xs overflow-y-auto flex-1">
              <div>
                <label className="text-gray-300 font-bold block mb-1">Tournament Title</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Weekend Gladiator 1v1, 4-Team Nether Conquest"
                  value={eventTitle}
                  onChange={e => setEventTitle(e.target.value)}
                  className="w-full p-2.5 bg-[#1c222b] border border-[#2d3847] rounded text-white outline-none focus:border-emerald-400 font-mono"
                />
              </div>

              {/* Event Mode Selector */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Battle Category & Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEventMode('1v1 Duel')}
                    className={`p-2.5 rounded border text-left cursor-pointer transition-all ${
                      eventMode === '1v1 Duel' ? 'border-amber-400 bg-amber-500/10 text-white' : 'border-[#2d3847] bg-[#1c222b] text-gray-400'
                    }`}
                  >
                    <div className="font-bold text-xs">⚔️ 1v1 Duel</div>
                    <div className="text-[10px] text-gray-400">Head-to-head 2 players</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEventMode('Multiplayer FFA')}
                    className={`p-2.5 rounded border text-left cursor-pointer transition-all ${
                      eventMode === 'Multiplayer FFA' ? 'border-amber-400 bg-amber-500/10 text-white' : 'border-[#2d3847] bg-[#1c222b] text-gray-400'
                    }`}
                  >
                    <div className="font-bold text-xs">💥 Multiplayer FFA</div>
                    <div className="text-[10px] text-gray-400">Free-For-All survival</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEventMode('2-Team Battle')}
                    className={`p-2.5 rounded border text-left cursor-pointer transition-all ${
                      eventMode === '2-Team Battle' ? 'border-amber-400 bg-amber-500/10 text-white' : 'border-[#2d3847] bg-[#1c222b] text-gray-400'
                    }`}
                  >
                    <div className="font-bold text-xs">🛡️ 2-Team Battle</div>
                    <div className="text-[10px] text-gray-400">Red vs Blue (No Friendly Fire)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEventMode('Multi-Team Battle')}
                    className={`p-2.5 rounded border text-left cursor-pointer transition-all ${
                      eventMode === 'Multi-Team Battle' ? 'border-amber-400 bg-amber-500/10 text-white' : 'border-[#2d3847] bg-[#1c222b] text-gray-400'
                    }`}
                  >
                    <div className="font-bold text-xs">👑 Multi-Team Battle</div>
                    <div className="text-[10px] text-gray-400">3-4 Teams clash</div>
                  </button>
                </div>
              </div>

              {/* Arena Environment Selector */}
              <div>
                <label className="text-gray-300 font-bold block mb-1">Arena Dimension Type (Disposable)</label>
                <select
                  value={arenaEnv}
                  onChange={e => setArenaEnv(e.target.value as any)}
                  className="w-full p-2.5 bg-[#1c222b] border border-[#2d3847] rounded text-white outline-none font-mono cursor-pointer"
                >
                  <option value="flat">🌌 Flat Arena (Clear Flatland)</option>
                  <option value="normal">🌿 Normal Overworld Wilderness</option>
                  <option value="nether">🔥 Nether Citadel</option>
                  <option value="the_end">👁️ The End Void</option>
                </select>
                <div className="text-[10px] text-emerald-400 mt-1">
                  ⚡ Auto-creates disposable dimension & destroys it after fight finishes!
                </div>
              </div>

              {/* Loot Banner Note */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-[11px] leading-relaxed">
                🗡️ <strong>Gear Rule:</strong> Participants bring their own loot, swords, and gear to fight!
              </div>

              {/* Player Autocomplete Inputs based on Mode */}
              {eventMode === '1v1 Duel' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-300 font-bold block mb-1">Combatant 1</label>
                    <PlayerAutocompleteInput 
                      value={player1}
                      onChange={setPlayer1}
                      placeholder="Type combatant 1 name..."
                      token={token}
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 font-bold block mb-1">Combatant 2</label>
                    <PlayerAutocompleteInput 
                      value={player2}
                      onChange={setPlayer2}
                      placeholder="Type combatant 2 name..."
                      token={token}
                    />
                  </div>
                </div>
              )}

              {eventMode === 'Multiplayer FFA' && (
                <div>
                  <label className="text-gray-300 font-bold block mb-1">FFA Participants (Type name to suggest)</label>
                  <PlayerAutocompleteInput 
                    value={ffaPlayers}
                    onChange={setFfaPlayers}
                    placeholder="Type player names separated by commas..."
                    isMulti={true}
                    token={token}
                  />
                </div>
              )}

              {(eventMode === '2-Team Battle' || eventMode === 'Multi-Team Battle') && (
                <div className="space-y-3">
                  <div className="p-2.5 bg-[#1c222b] border border-red-500/40 rounded space-y-2">
                    <label className="text-red-400 font-bold block text-xs">Team 1 (Red)</label>
                    <input type="text" placeholder="Team Name" value={team1Name} onChange={e => setTeam1Name(e.target.value)} className="w-full p-1.5 bg-[#12161c] border border-[#2d3847] rounded text-white" />
                    <PlayerAutocompleteInput 
                      value={team1Members}
                      onChange={setTeam1Members}
                      placeholder="Members (Type to suggest)..."
                      isMulti={true}
                      token={token}
                    />
                  </div>

                  <div className="p-2.5 bg-[#1c222b] border border-blue-500/40 rounded space-y-2">
                    <label className="text-blue-400 font-bold block text-xs">Team 2 (Blue)</label>
                    <input type="text" placeholder="Team Name" value={team2Name} onChange={e => setTeam2Name(e.target.value)} className="w-full p-1.5 bg-[#12161c] border border-[#2d3847] rounded text-white" />
                    <PlayerAutocompleteInput 
                      value={team2Members}
                      onChange={setTeam2Members}
                      placeholder="Members (Type to suggest)..."
                      isMulti={true}
                      token={token}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-5 rounded text-xs shadow cursor-pointer flex items-center space-x-1"
                >
                  <Swords size={14} />
                  <span>Start Match Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTRATION PORTAL INFO MODAL */}
      {showRegInfoModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1c222b] rounded-sm shadow-2xl border border-[#2d3847] w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 text-white p-3 font-bold flex justify-between items-center select-none">
              <div className="flex items-center space-x-2">
                <Link size={16} />
                <span className="text-sm tracking-wide">Tournament Registration Methods</span>
              </div>
              <button onClick={() => setShowRegInfoModal(false)} className="text-white hover:text-gray-200 font-bold">✕</button>
            </div>

            <div className="p-4 bg-[#12161c] space-y-3 font-mono text-xs text-gray-300">
              <div className="p-2.5 bg-[#1c222b] border border-[#2d3847] rounded space-y-1">
                <div className="text-white font-bold flex items-center space-x-1.5">
                  <UserCheck size={14} className="text-emerald-400" />
                  <span>Method 1: Direct Admin Registration</span>
                </div>
                <p className="text-[11px] text-gray-400">Players contact admins in-game or via Discord to join the active match roster.</p>
              </div>

              <div className="p-2.5 bg-[#1c222b] border border-[#2d3847] rounded space-y-1">
                <div className="text-white font-bold flex items-center space-x-1.5">
                  <Globe size={14} className="text-blue-400" />
                  <span>Method 2: Designated Website Registration</span>
                </div>
                <p className="text-[11px] text-gray-400">Web registration portal link: <code className="text-amber-400">http://localhost:3000/register-event</code> (Ready for website integration).</p>
              </div>
            </div>

            <div className="bg-[#1c222b] p-3 border-t border-[#2d3847] flex justify-end">
              <button onClick={() => setShowRegInfoModal(false)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
