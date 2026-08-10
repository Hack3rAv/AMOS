import { useState, useEffect } from 'react';
import { Sun, Moon, CloudRain, CloudLightning, Lock, Unlock, Zap, Clock, Pause, Snowflake } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

// Perfect Organic Fluffy SVG Cloud Component
function PerfectCloudSVG({ storm = false, className = '' }: { storm?: boolean, className?: string }) {
  const mainGrad = storm ? "stormMainGrad" : "rainMainGrad";
  const puffGrad = storm ? "stormPuffGrad" : "rainPuffGrad";

  return (
    <svg viewBox="0 0 124 60" className={`w-44 h-22 drop-shadow-[0_10px_22px_rgba(0,0,0,0.6)] ${className}`}>
      <defs>
        <linearGradient id={mainGrad} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={storm ? "#3b4259" : "#7e8ca8"} />
          <stop offset="50%" stopColor={storm ? "#25293b" : "#56627a"} />
          <stop offset="100%" stopColor={storm ? "#171a26" : "#384152"} />
        </linearGradient>
        <linearGradient id={puffGrad} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={storm ? "#5c6687" : "#b8ceef"} stopOpacity="0.7" />
          <stop offset="100%" stopColor={storm ? "#2b3044" : "#606f8c"} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d="M 25,55 
           C 12,55 2,45 2,32 
           C 2,20 12,10 24,9 
           C 30,3 39,0 49,0 
           C 63,0 75,7 81,18 
           C 87,13 95,10 103,10 
           C 113,10 122,18 122,28 
           C 122,39 113,47 103,48 
           C 99,53 91,55 83,55 
           Z"
        fill={`url(#${mainGrad})`}
      />

      <path
        d="M 24,9 
           C 30,3 39,0 49,0 
           C 63,0 75,7 81,18 
           C 87,13 95,10 103,10 
           C 113,10 122,18 122,28 
           C 118,20 108,13 98,13 
           C 90,13 83,16 78,22 
           C 72,12 61,5 49,5 
           C 38,5 29,10 24,18 
           Z"
        fill={`url(#${puffGrad})`}
      />
    </svg>
  );
}

// Real Jagged Lightning Bolt Strike Component
function LightningStrike() {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 animate-lightning">
      <div className="absolute inset-0 bg-indigo-200/15" />
      <svg className="absolute top-10 left-[32%] w-24 h-64 text-amber-200 drop-shadow-[0_0_22px_rgba(251,191,36,1)]" viewBox="0 0 100 200">
        <polygon points="55,0 20,95 48,95 12,200 85,85 52,85 82,0" fill="currentColor" />
      </svg>
      <svg className="absolute top-14 left-[64%] w-16 h-48 text-cyan-200 drop-shadow-[0_0_18px_rgba(165,243,252,0.9)] opacity-90" viewBox="0 0 100 200">
        <polygon points="50,0 22,80 46,80 15,180 78,70 50,70 75,0" fill="currentColor" />
      </svg>
    </div>
  );
}

export function WeatherTab({ token }: { token: string }) {
  const [ticks, setTicks] = useState(6000); // 6000 = 12:00 (Noon)
  const [weather, setWeather] = useState<'clear' | 'rain' | 'thunder'>('clear');
  const [lockTime, setLockTime] = useState(false);
  const [isTickFrozen, setIsTickFrozen] = useState(false);
  const [lockWeather, setLockWeather] = useState(false);
  const [isEditingClock, setIsEditingClock] = useState(false);
  const [editTimeString, setEditTimeString] = useState('');

  // Continuous clock ticking (Active when time is not locked and ticks not frozen)
  useEffect(() => {
    if (lockTime || isTickFrozen) return;
    const interval = setInterval(() => {
      setTicks((prev) => (prev + 20) % 24000);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockTime, isTickFrozen]);

  const sendCommand = async (cmd: string) => {
    try {
      await fetch(`${API_BASE}/server/command`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
    } catch (e) {}
  };

  const handleTimeChange = (newTicks: number) => {
    const validTicks = Math.max(0, Math.min(24000, newTicks));
    setTicks(validTicks);
    sendCommand(`time set ${validTicks}`);
  };

  const saveEditedTime = (str: string) => {
    setIsEditingClock(false);
    const parts = str.trim().split(':');
    if (parts.length >= 1) {
      const hrs = parseInt(parts[0], 10);
      const mins = parts.length > 1 ? parseInt(parts[1], 10) : 0;
      if (!isNaN(hrs) && hrs >= 0 && hrs < 24) {
        const validMins = !isNaN(mins) && mins >= 0 && mins < 60 ? mins : 0;
        const totalSecs = hrs * 3600 + validMins * 60;
        const newTicks = Math.floor(((totalSecs - 21600 + 86400) % 86400) / 86400 * 24000);
        handleTimeChange(newTicks);
      }
    }
  };

  const handleWeatherChange = (newWeather: 'clear' | 'rain' | 'thunder') => {
    setWeather(newWeather);
    sendCommand(`weather ${newWeather}`);
  };

  const toggleLockTime = () => {
    const next = !lockTime;
    setLockTime(next);
    sendCommand(`gamerule doDaylightCycle ${next ? 'false' : 'true'}`);
  };

  const toggleTickFreeze = () => {
    const next = !isTickFrozen;
    setIsTickFrozen(next);
    sendCommand(next ? 'tick freeze' : 'tick unfreeze');
  };

  const toggleLockWeather = () => {
    const next = !lockWeather;
    setLockWeather(next);
    sendCommand(`gamerule doWeatherCycle ${next ? 'false' : 'true'}`);
  };

  // Convert ticks (0 - 24000) to 24-hour time format HH:MM.SS
  const formatMinecraftTime = (t: number) => {
    const totalSeconds = Math.floor(((t + 6000) % 24000) / 24000 * 86400);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return { hours, mins, secs };
  };

  const timeDisplay = formatMinecraftTime(ticks);

  // Wide Horizon Sky Dome Trajectory (Spans full width from 7.5% to 92.5%)
  const isDaytime = ticks < 12000 || ticks >= 23000;
  const normalizedProgress = isDaytime
    ? (ticks >= 23000 ? (ticks - 23000) / 13000 : (ticks + 1000) / 13000)
    : (ticks - 12000) / 11000;
  
  const arcAngle = Math.PI * Math.min(Math.max(normalizedProgress, 0), 1);
  const iconX = 50 - 42.5 * Math.cos(arcAngle); // percentage X
  const iconY = 84.375 - 65.625 * Math.sin(arcAngle); // percentage Y

  const showSunMoon = weather !== 'thunder';

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-6">
      {/* Top Controls Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#2b2b36] border border-[#3e3e4a] p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <Sun size={18} className="text-amber-400" />
          <span className="text-xs font-bold text-gray-200 uppercase tracking-widest">
            Weather & Time Control
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Day / Night Presets */}
          <div className="flex items-center bg-[#1e1e24] p-1 rounded-lg border border-[#3e3e4a] gap-1">
            <button
              onClick={() => handleTimeChange(1000)}
              className={`p-1.5 rounded transition-all ${ticks === 1000 ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              title="Sunrise (06:00)"
            >
              <Sun size={16} />
            </button>
            <button
              onClick={() => handleTimeChange(6000)}
              className={`p-1.5 rounded transition-all ${ticks === 6000 ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              title="Noon (12:00)"
            >
              <Sun size={16} className="text-amber-400" />
            </button>
            <button
              onClick={() => handleTimeChange(13000)}
              className={`p-1.5 rounded transition-all ${ticks === 13000 ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              title="Sunset (18:00)"
            >
              <Moon size={16} className="text-indigo-300" />
            </button>
            <button
              onClick={() => handleTimeChange(18000)}
              className={`p-1.5 rounded transition-all ${ticks === 18000 ? 'bg-emerald-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              title="Midnight (00:00)"
            >
              <Moon size={16} />
            </button>
          </div>

          <div className="w-px h-5 bg-[#3e3e4a]" />

          {/* 3 Distinct Controls: Lock Time, Freeze Ticks, Lock Weather */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#1e1e24] p-1 rounded-lg border border-[#3e3e4a]">
            {/* Lock Daylight Cycle (gamerule doDaylightCycle false) */}
            <button
              onClick={toggleLockTime}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 text-xs font-extrabold ${
                lockTime ? 'bg-amber-600 text-white shadow' : 'text-gray-300 hover:bg-[#2b2b36] hover:text-white'
              }`}
              title={lockTime ? "Daylight Cycle Locked (doDaylightCycle false)" : "Lock Daylight Cycle"}
            >
              <Clock size={14} className="text-amber-400" />
              {lockTime ? <Lock size={13} /> : <Unlock size={13} />}
              <span>{lockTime ? 'Time Locked' : 'Lock Time'}</span>
            </button>

            {/* Freeze Server Ticks (tick freeze / tick unfreeze) */}
            <button
              onClick={toggleTickFreeze}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 text-xs font-extrabold ${
                isTickFrozen ? 'bg-cyan-600 text-white shadow' : 'text-gray-300 hover:bg-[#2b2b36] hover:text-white'
              }`}
              title={isTickFrozen ? "Server Ticks Frozen (tick freeze)" : "Freeze Server Ticks"}
            >
              <Snowflake size={14} className="text-cyan-400" />
              {isTickFrozen ? <Pause size={13} /> : <Zap size={13} />}
              <span>{isTickFrozen ? 'Ticks Frozen' : 'Freeze Ticks'}</span>
            </button>

            {/* Lock Weather Cycle (gamerule doWeatherCycle false) */}
            <button
              onClick={toggleLockWeather}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 text-xs font-extrabold ${
                lockWeather ? 'bg-purple-600 text-white shadow' : 'text-gray-300 hover:bg-[#2b2b36] hover:text-white'
              }`}
              title={lockWeather ? "Weather Cycle Locked (doWeatherCycle false)" : "Lock Weather Cycle"}
            >
              <CloudRain size={14} className="text-sky-400" />
              {lockWeather ? <Lock size={13} /> : <Unlock size={13} />}
              <span>{lockWeather ? 'Weather Locked' : 'Lock Weather'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Sky Stage Canvas */}
      <div className={`relative w-full h-80 rounded-2xl border border-[#3e3e4a] overflow-hidden shadow-2xl transition-all duration-700 flex flex-col items-center justify-between p-6 ${
        weather === 'thunder'
          ? 'bg-gradient-to-b from-[#160a22] via-[#100c1b] to-[#07060d]'
          : weather === 'rain'
          ? 'bg-gradient-to-b from-[#121d30] via-[#131622] to-[#0a0c14]'
          : isDaytime
          ? 'bg-gradient-to-b from-[#2b2214] via-[#1e1e24] to-[#121217]'
          : 'bg-gradient-to-b from-[#0f172a] via-[#1e1e24] to-[#0a0d14]'
      }`}>

        {/* Real Jagged Lightning Strikes on Thunderstorm */}
        {weather === 'thunder' && <LightningStrike />}

        {/* Organic Floating Clouds Layer (Extra Heavy Cloud Cover on Thunderstorm) */}
        {weather === 'thunder' ? (
          <div className="absolute top-3 inset-x-0 pointer-events-none z-10 flex justify-between items-center px-1">
            <PerfectCloudSVG storm={true} className="scale-90 animate-cloud-glide-1" />
            <PerfectCloudSVG storm={true} className="-ml-10 scale-110 -mt-2 animate-cloud-glide-2" />
            <PerfectCloudSVG storm={true} className="-ml-8 scale-125 -mt-3 animate-cloud-glide-3" />
            <PerfectCloudSVG storm={true} className="-mr-8 scale-110 -mt-2 animate-cloud-glide-1" />
            <PerfectCloudSVG storm={true} className="scale-95 animate-cloud-glide-2" />
          </div>
        ) : weather === 'rain' ? (
          <div className="absolute top-5 inset-x-0 pointer-events-none z-10 flex justify-between items-center px-4">
            <PerfectCloudSVG storm={false} className="animate-cloud-glide-1" />
            <PerfectCloudSVG storm={false} className="-mt-4 scale-110 animate-cloud-glide-2" />
            <PerfectCloudSVG storm={false} className="animate-cloud-glide-3" />
          </div>
        ) : null}

        {/* Rain Particles */}
        {(weather === 'rain' || weather === 'thunder') && (
          <div className="absolute top-24 inset-x-0 bottom-0 pointer-events-none overflow-hidden z-0">
            {Array.from({ length: 36 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-[1.5px] h-7 bg-cyan-300/45 rounded-full animate-rain-drop"
                style={{
                  left: `${(i * 2.77) + (i % 3)}%`,
                  top: `0px`,
                  animationDuration: `${0.45 + (i % 4) * 0.1}s`,
                  animationDelay: `${(i % 5) * 0.08}s`
                }}
              />
            ))}
          </div>
        )}



        {/* Sun or Moon Moving on Arc */}
        {showSunMoon && (
          <div
            className="absolute z-20 transition-all duration-500 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
            style={{ left: `${iconX}%`, top: `${iconY}%` }}
          >
            {isDaytime ? (
              /* Cute Animated Sun */
              <div className="relative group">
                <div className="absolute -inset-3 bg-amber-400/30 rounded-full blur-md animate-pulse" />
                <div className="relative w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.8)] border-2 border-amber-300">
                  <div className="flex flex-col items-center justify-center select-none">
                    <div className="flex gap-1.5 mb-0.5">
                      <div className="w-1.5 h-1.5 bg-amber-950 rounded-full" />
                      <div className="w-1.5 h-1.5 bg-amber-950 rounded-full" />
                    </div>
                    <div className="flex gap-2.5 -mt-1 mb-0.5">
                      <div className="w-1.5 h-1 bg-pink-400/80 rounded-full" />
                      <div className="w-1.5 h-1 bg-pink-400/80 rounded-full" />
                    </div>
                    <div className="w-2 h-0.5 border-b-2 border-amber-950 rounded-full" />
                  </div>
                  <div className="absolute inset-0 -m-1 border-2 border-dashed border-amber-300/60 rounded-full animate-sun-spin" />
                </div>
              </div>
            ) : (
              /* Animated Moon */
              <div className="relative group">
                <div className="absolute -inset-2 bg-indigo-300/20 rounded-full blur-md" />
                <div className="relative w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(226,232,240,0.6)] border-2 border-slate-100 overflow-hidden">
                  <Moon size={20} className="text-slate-800 fill-slate-800" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Digital LED Clock (Auto-ticking & Click-to-Edit) */}
        <div className="absolute bottom-3 flex flex-col items-center justify-center z-30">
          {isEditingClock ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveEditedTime(editTimeString);
              }}
              className="bg-black/95 border-2 border-amber-400 px-3 py-1 rounded-xl shadow-2xl flex items-center gap-2"
            >
              <input
                type="text"
                autoFocus
                value={editTimeString}
                onChange={(e) => setEditTimeString(e.target.value)}
                onBlur={() => saveEditedTime(editTimeString)}
                placeholder="12:00"
                className="w-24 bg-transparent font-mono text-2xl font-extrabold text-amber-300 text-center outline-none"
              />
              <button
                type="submit"
                className="text-[11px] px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-lg shadow uppercase transition-colors"
              >
                Set
              </button>
            </form>
          ) : (
            <div
              onClick={() => {
                setEditTimeString(`${timeDisplay.hours}:${timeDisplay.mins}`);
                setIsEditingClock(true);
              }}
              className="bg-black/85 border border-[#3e3e4a] hover:border-amber-400/60 px-4 py-1.5 rounded-xl shadow-xl flex items-baseline tracking-wider font-mono cursor-pointer transition-all hover:scale-105 group select-none"
              title="Click to edit time (HH:MM)"
            >
              <span className="text-2xl md:text-3xl font-extrabold text-white group-hover:text-amber-300 transition-colors drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
                {timeDisplay.hours}:{timeDisplay.mins}
              </span>
              <span className="text-base font-bold text-gray-400 ml-1">
                .{timeDisplay.secs}
              </span>
            </div>
          )}

          <div className="text-[10px] font-mono text-gray-300 mt-1 bg-black/60 px-2.5 py-0.5 rounded-full border border-white/10 shadow-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{isDaytime ? 'Daytime' : 'Nighttime'} • {ticks} ticks</span>
          </div>
        </div>
      </div>

      {/* Weather Action Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sunny / Clear Button */}
        <button
          onClick={() => handleWeatherChange('clear')}
          className={`relative overflow-hidden p-4 rounded-xl border transition-all duration-300 flex items-center justify-between group ${
            weather === 'clear'
              ? 'bg-amber-500/20 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'bg-[#2b2b36] border-[#3e3e4a] text-gray-300 hover:border-amber-400 hover:text-white'
          }`}
        >
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-400/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          
          <div className="flex items-center space-x-3 z-10">
            <div className="p-2.5 bg-amber-500/20 rounded-lg text-amber-400 group-hover:rotate-45 transition-transform duration-500">
              <Sun size={24} className="group-hover:animate-sun-spin" />
            </div>
            <div className="text-left">
              <div className="font-bold text-base">Sunny / Clear</div>
              <div className="text-xs text-gray-400">Clear sky, full visibility</div>
            </div>
          </div>
        </button>

        {/* Rain Button */}
        <button
          onClick={() => handleWeatherChange('rain')}
          className={`relative overflow-hidden p-4 rounded-xl border transition-all duration-300 flex items-center justify-between group ${
            weather === 'rain'
              ? 'bg-blue-500/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
              : 'bg-[#2b2b36] border-[#3e3e4a] text-gray-300 hover:border-blue-400 hover:text-white'
          }`}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none overflow-hidden">
            <PerfectCloudSVG className="absolute -top-3 right-0 scale-75 opacity-60" />
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-[1.5px] h-4 bg-cyan-300/60 rounded-full animate-rain-drop"
                style={{ left: `${10 * i + 5}%`, top: '15px', animationDuration: `${0.5 + (i % 3) * 0.1}s` }}
              />
            ))}
          </div>

          <div className="flex items-center space-x-3 z-10">
            <div className="p-2.5 bg-blue-500/20 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
              <CloudRain size={24} />
            </div>
            <div className="text-left">
              <div className="font-bold text-base">Rain</div>
              <div className="text-xs text-gray-400">Precipitation & cloud cover</div>
            </div>
          </div>
        </button>

        {/* Thunderstorm Button */}
        <button
          onClick={() => handleWeatherChange('thunder')}
          className={`relative overflow-hidden p-4 rounded-xl border transition-all duration-300 flex items-center justify-between group ${
            weather === 'thunder'
              ? 'bg-purple-500/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
              : 'bg-[#2b2b36] border-[#3e3e4a] text-gray-300 hover:border-purple-400 hover:text-white'
          }`}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none overflow-hidden">
            <PerfectCloudSVG storm={true} className="absolute -top-3 right-0 scale-75 opacity-80" />
            <div className="absolute inset-0 bg-purple-500/10 animate-lightning" />
            <svg className="absolute top-2 right-12 w-6 h-12 text-amber-300 animate-lightning" viewBox="0 0 100 200">
              <polygon points="50,0 20,90 45,90 10,200 80,80 50,80 80,0" fill="currentColor" />
            </svg>
          </div>

          <div className="flex items-center space-x-3 z-10">
            <div className="p-2.5 bg-purple-500/20 rounded-lg text-purple-400 group-hover:scale-110 transition-transform">
              <CloudLightning size={24} />
            </div>
            <div className="text-left">
              <div className="font-bold text-base">Thunderstorm</div>
              <div className="text-xs text-gray-400">Heavy storm & lightning</div>
            </div>
          </div>
        </button>
      </div>

      {/* Interactive Time Slider */}
      <div className="bg-[#2b2b36] border border-[#3e3e4a] rounded-xl p-5 shadow-lg space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="font-bold text-gray-200 flex items-center gap-2">
            <Zap size={16} className="text-emerald-400" /> Time Tick Selector
          </span>
          <span className="font-mono text-xs text-emerald-400 font-bold bg-[#1e1e24] px-3 py-1 rounded border border-[#3e3e4a]">
            {ticks} / 24000 ticks
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="24000"
          step="250"
          value={ticks}
          onChange={(e) => handleTimeChange(parseInt(e.target.value))}
          className="w-full h-2 bg-[#1e1e24] rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />

        <div className="flex justify-between text-[11px] text-gray-400 font-mono pt-1">
          <span>0 (06:00 Sunrise)</span>
          <span>6000 (12:00 Noon)</span>
          <span>12000 (18:00 Sunset)</span>
          <span>18000 (00:00 Midnight)</span>
          <span>24000</span>
        </div>
      </div>
    </div>
  );
}
