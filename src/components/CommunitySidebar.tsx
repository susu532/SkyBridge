import React, { useEffect, useState } from 'react';
import { settingsManager, GameSettings } from '../game/Settings';
import { networkManager } from '../game/NetworkManager';
import { useGameStore } from '../store/gameStore';
import { Users, Trash2, UserPlus, LogIn, Save, MessageSquare, Check, X, Send } from 'lucide-react';

interface FriendItem {
  id: string;
  name: string;
  online: boolean;
  status?: string;
  avatarColor?: string;
}

export const CommunitySidebar: React.FC = () => {
  const [settings, setSettings] = useState<GameSettings>(settingsManager.getSettings());
  const [cgUser, setCgUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'social'>('social');

  const friendRequests = useGameStore(state => state.friendRequests);
  const partyInvites = useGameStore(state => state.partyInvites);
  const removeFriendRequest = useGameStore(state => state.removeFriendRequest);
  const removePartyInvite = useGameStore(state => state.removePartyInvite);

  // Status message state
  const [statusTag, setStatusTag] = useState<string>(() => {
    return localStorage.getItem('starplex_user_status') || 'Delving Dungeon ⚔️';
  });

  useEffect(() => {
    localStorage.setItem('starplex_user_status', statusTag);
    // sync with CrazyGames if possible
    try {
      if ((window as any).CrazyGames?.SDK?.data) {
         (window as any).CrazyGames.SDK.data.setItem('starplex_user_status', statusTag);
      }
    } catch(e) {}
  }, [statusTag]);

  // Try to load initial status and user from CG
  useEffect(() => {
    const initCG = async () => {
      try {
        if ((window as any).CrazyGames?.SDK) {
          if ((window as any).CrazyGames.SDK.user) {
            const user = await (window as any).CrazyGames.SDK.user.getUser();
            if (user) setCgUser(user);
          }
          if ((window as any).CrazyGames.SDK.data) {
             const savedStatus = await (window as any).CrazyGames.SDK.data.getItem('starplex_user_status');
             if (savedStatus) setStatusTag(savedStatus);
          }
        }
      } catch(e) {
        console.error("CG SDK Error", e);
      }
    };
    initCG();
  }, []);

  const handleCGLogin = async () => {
    if ((window as any).CrazyGames?.SDK?.user) {
      try {
        const user = await (window as any).CrazyGames.SDK.user.showAuthPrompt();
        if (user) setCgUser(user);
      } catch(e) {
        console.error("CG Auth failed", e);
      }
    } else {
       alert("CrazyGames SDK not available");
    }
  };

  // Friends state - empty by default so it represents a real friending system
  const [friends, setFriends] = useState<FriendItem[]>(() => {
    const saved = localStorage.getItem('starplex_friends');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Explicitly clear out old fake friends saved in user's localStorage
          const dummyIds = ['1', '2', '3', '4', '5'];
          const dummyNames = ['Dream', 'Technoblade', 'DungeonMaster', 'Cofl', 'Hypixel'];
          return parsed.filter(friend => 
            friend && 
            friend.id && 
            !dummyIds.includes(friend.id) && 
            !dummyNames.includes(friend.name)
          );
        }
      } catch (e) {
        // ignore
      }
    }
    return [];
  });

  // A 1-second state tick to keep friends online status & active lobby list synchronized in real-time
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getDynamicFriendInfo = (friend: FriendItem) => {
    // Look up current network players
    const activeSessionPlayers = Object.values(networkManager.players || {});
    const activePlayer = activeSessionPlayers.find((p: any) => p && p.name && p.name.toUpperCase() === friend.name.toUpperCase());

    if (activePlayer) {
      let locName = 'In Game';
      try {
         const srv = new URLSearchParams(window.location.search).get('server') || 'dungeondelver';
         locName = srv.charAt(0).toUpperCase() + srv.slice(1);
      } catch (e) {}

      return {
        online: true,
        status: activePlayer.isDead ? 'Waiting for Respawn 💀' : `Playing ${locName} ⚔️`,
        avatarColor: friend.avatarColor || '#C6895C'
      };
    }

    return {
      online: false,
      status: 'Offline',
      avatarColor: friend.avatarColor || '#C6895C'
    };
  };

  useEffect(() => {
    localStorage.setItem('starplex_friends', JSON.stringify(friends));
  }, [friends]);

  useEffect(() => {
    const handler = (e: any) => {
      forceAddFriendByName(e.detail);
    };
    window.addEventListener('friendAcceptedNetwork', handler);
    return () => window.removeEventListener('friendAcceptedNetwork', handler);
  }, [friends]);

  const [newFriendName, setNewFriendName] = useState('');

  const forceAddFriendByName = (name: string) => {
    if (!name.trim()) return;
    const nameStr = name.trim();
    if (friends.some(f => f.name.toUpperCase() === nameStr.toUpperCase())) return;

    const randomColors = ['#C6895C', '#5F3A19', '#4E5F19', '#194B5F', '#5F194E', '#E09944', '#44E099', '#9944E0'];
    const randomColor = randomColors[Math.floor(Math.random() * randomColors.length)];

    setFriends(prev => [...prev, {
      id: Date.now().toString(),
      name: nameStr,
      online: true,
      avatarColor: randomColor
    }]);
  };

  const handleAddFriendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;
    
    // Instead of immediately adding, we send a request via NetworkManager
    networkManager.sendFriendRequest(newFriendName.trim());
    useGameStore.getState().addChatMessage("System", `§eFriend request sent to ${newFriendName.trim()}`);
    setNewFriendName('');
  };

  const handleDeleteFriend = (id: string) => {
    setFriends(prev => prev.filter(f => f.id !== id));
  };

  useEffect(() => {
    return settingsManager.subscribe(setSettings);
  }, []);

  const handleChange = (key: keyof GameSettings, value: any) => {
    settingsManager.updateSettings({ [key]: value });
    if (key === 'username') {
      networkManager.updateProfile({ name: value });
    }
  };

  const handleAcceptFriendRequest = (req: {sourceId: string, sourceName: string}) => {
    networkManager.acceptFriendRequest(req.sourceId);
    forceAddFriendByName(req.sourceName);
    removeFriendRequest(req.sourceId);
  };

  const handleAcceptPartyInvite = (req: {sourceId: string, sourceName: string, server: string}) => {
    networkManager.acceptPartyInvite(req.sourceId);
    removePartyInvite(req.sourceId);
    networkManager.initMatchmaking(req.server);
  };

  // Find other players currently online in the lobby that are NOT on our friends list
  const activeSessionPlayers = Object.values(networkManager.players || {});
  const lobbyPlayers = activeSessionPlayers
    .filter((p: any) => p && p.name && p.id !== networkManager.id)
    .filter((p: any) => !friends.some(f => f.name.toUpperCase() === p.name.toUpperCase()));

  return (
    <div className="w-full h-full bg-[#9F9F9F] p-2 sm:p-4 flex flex-col gap-2 sm:gap-4 mc-font select-none text-left pointer-events-auto">
      {/* Sidebar Header */}
      <div className="flex bg-[#8B8B8B] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] border-2 border-[#555555] shrink-0">
        <button 
          className={`flex-1 py-1.5 text-xs font-bold uppercase ${activeTab === 'social' ? 'bg-[#555555] text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] border-b-2 border-white' : 'text-white/60 hover:bg-[#A3A3A3] hover:text-white'}`}
          onClick={() => setActiveTab('social')}
        >
          Social
        </button>
        <button 
          className={`flex-1 py-1.5 text-xs font-bold uppercase ${activeTab === 'profile' ? 'bg-[#555555] text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] border-b-2 border-white' : 'text-white/60 hover:bg-[#A3A3A3] hover:text-white'}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="bg-[#8B8B8B] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] p-2 sm:p-3 space-y-1.5 sm:space-y-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 border-2 border-[#555555] bg-[#C6895C] shadow-md">
              <svg width="100%" height="100%" viewBox="0 0 8 8" shapeRendering="crispEdges">
                <rect x="0" y="0" width="8" height="8" fill="#C6895C" />
                <rect x="0" y="0" width="8" height="2" fill="#5F3A19" />
                <rect x="0" y="2" width="1" height="2" fill="#5F3A19" />
                <rect x="7" y="2" width="1" height="2" fill="#5F3A19" />
                <rect x="2" y="6" width="4" height="1" fill="#5F3A19" />
                <rect x="1" y="4" width="2" height="1" fill="#FFFFFF" />
                <rect x="5" y="4" width="2" height="1" fill="#FFFFFF" />
                <rect x="2" y="4" width="1" height="1" fill="#4B6EFF" />
                <rect x="5" y="4" width="1" height="1" fill="#4B6EFF" />
                <rect x="3" y="5" width="2" height="1" fill="#9B6043" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-white text-xs truncate uppercase tracking-wider drop-shadow-[1px_1px_0_rgba(0,0,0,1)]">
                  {settings.username || 'PLAYER'}
                </span>
              </div>
              <p className="text-[9px] text-green-300 font-bold tracking-wider pt-0.5 uppercase">● Profile Account</p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-black/60 uppercase block">Edit Username</label>
            <input 
              type="text" 
              value={settings.username || ''}
              onChange={(e) => handleChange('username', e.target.value)}
              maxLength={14}
              className="w-full text-xs font-bold bg-[#A3A3A3] border-2 border-black/30 text-white rounded-none px-2 py-1 focus:outline-none focus:border-white uppercase placeholder-white/30"
              placeholder="Enter Username"
            />
          </div>

          {/* Status Selection */}
          <div className="space-y-1 pt-1 border-t border-black/15">
            <label className="text-[10px] font-bold text-black/60 uppercase block">Status Message</label>
            <select
              value={statusTag}
              onChange={(e) => setStatusTag(e.target.value)}
              className="w-full text-[10px] font-bold bg-[#A3A3A3] text-white border-2 border-black/30 px-1 py-0.5 rounded-none block mb-2"
            >
              <option value="Delving Dungeon ...">Delving Dungeon ⚔️</option>
              <option value="Chilling in Hub ...">Chilling in Hub 🌳</option>
              <option value="Lobby AFK ...">Lobby AFK ☕</option>
            </select>
          </div>

          {/* CrazyGames Auth */}
          <div className="space-y-1 pt-2 border-t border-black/15 flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-black/60 uppercase block">Cloud Save (CrazyGames)</label>
            {cgUser ? (
               <div className="flex items-center gap-1.5 text-[10px] text-green-300 font-bold uppercase drop-shadow-[1px_1px_0_rgba(0,0,0,1)] bg-black/40 px-2 py-1 border border-black/30">
                 <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                 {cgUser.username || 'User'}
               </div>
            ) : (
              <button
                onClick={handleCGLogin}
                className="w-full flex items-center justify-center gap-2 bg-[#612A9E] hover:bg-[#7236B5] text-white text-[10px] font-bold uppercase py-1.5 border-2 border-[#4A1F7A] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
              >
                <LogIn className="w-3.5 h-3.5" /> Login to CrazyGames
              </button>
            )}
            <button
               onClick={() => {
                  if ((window as any).CrazyGames?.SDK?.data) {
                      (window as any).CrazyGames.SDK.data.setItem('starplex_user_status', statusTag);
                      (window as any).CrazyGames.SDK.data.setItem('starplex_friends', JSON.stringify(friends));
                      alert("Game Data Saved to Cloud Sync!");
                  } else {
                      alert("Cloud Save unavailable (CrazyGames SDK not found)");
                  }
               }}
               className="w-full flex items-center justify-center gap-2 bg-[#2D7335] hover:bg-[#348A3D] text-white text-[10px] font-bold uppercase py-1 border-2 border-[#1E4D24] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
            >
               <Save className="w-3 h-3" /> Save Data to Cloud
            </button>
          </div>
        </div>
      )}

      {activeTab === 'social' && (
        <div className="bg-[#8B8B8B] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555555] p-2 sm:p-3 flex flex-col gap-1 sm:gap-2 flex-1 min-h-0 overflow-hidden">
          
          {/* Incoming Events */}
          {(friendRequests.length > 0 || partyInvites.length > 0) && (
             <div className="flex-none mb-1 border-b-2 border-black/15 pb-2">
                {friendRequests.map((req, i) => (
                   <div key={`fr-${i}`} className="bg-yellow-600/30 border border-yellow-500/50 p-1.5 flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-white tracking-wide uppercase"><span className="text-yellow-300">{req.sourceName}</span> sent a friend request</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleAcceptFriendRequest(req)} className="bg-green-600 hover:bg-green-500 p-1 border border-black/50 text-white"><Check className="w-3 h-3" /></button>
                        <button onClick={() => removeFriendRequest(req.sourceId)} className="bg-red-600 hover:bg-red-500 p-1 border border-black/50 text-white"><X className="w-3 h-3" /></button>
                      </div>
                   </div>
                ))}
                {partyInvites.map((req, i) => (
                   <div key={`pi-${i}`} className="bg-blue-600/30 border border-blue-500/50 p-1.5 flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-white tracking-wide uppercase"><span className="text-blue-300">{req.sourceName}</span> invited you to Party</span>
                      <div className="flex gap-1">
                        <button onClick={() => handleAcceptPartyInvite(req)} className="bg-green-600 hover:bg-green-500 p-1 border border-black/50 text-white"><Check className="w-3 h-3" /></button>
                        <button onClick={() => removePartyInvite(req.sourceId)} className="bg-red-600 hover:bg-red-500 p-1 border border-black/50 text-white"><X className="w-3 h-3" /></button>
                      </div>
                   </div>
                ))}
             </div>
          )}

          {/* Friends Sub-Section */}
          <div className="flex items-center justify-between border-b-2 border-black/15 pb-1 shrink-0">
            <span className="font-bold text-white text-[11px] uppercase tracking-wide flex items-center gap-1">
              Friends List ({friends.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 py-1 custom-scrollbar min-h-0">
            {friends.map(friend => {
              const info = getDynamicFriendInfo(friend);
              return (
                <div key={friend.id} className="flex items-center justify-between bg-black/20 p-1.5 border border-black/15 hover:bg-black/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 bg-[#C6895C] border border-black/30 shrink-0">
                      <svg width="100%" height="100%" viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="0" y="0" width="8" height="8" fill={info.avatarColor || '#C6895C'} />
                        <rect x="2" y="2" width="4" height="2" fill="#4B2D10" />
                        <rect x="2" y="4" width="1" height="1" fill="#5555FF" />
                        <rect x="5" y="4" width="1" height="1" fill="#5555FF" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex flex-col items-start text-left">
                      <span className="text-white text-xs font-bold truncate leading-none mb-0.5 uppercase text-left">{friend.name}</span>
                      <span className={`text-[9px] truncate tracking-wide text-left ${info.online ? 'text-green-300 font-bold' : 'text-white/40'}`}>
                        {info.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => {
                        networkManager.sendPartyInvite(friend.name);
                        useGameStore.getState().addChatMessage("System", `§eParty invite sent to ${friend.name} (if online).`);
                      }}
                      className="p-1 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors rounded-sm"
                      title="Invite to Party"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFriend(friend.id)}
                      className="p-1 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors rounded-sm"
                      title="Remove Friend"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {friends.length === 0 && (
              <div className="text-white/40 text-[10px] italic text-center py-4">No friends added...</div>
            )}
          </div>

          {/* Players in Lobby Sub-Section */}
          <div className="flex items-center justify-between border-t border-b-2 border-black/15 pt-2 pb-1 shrink-0 mt-1">
            <span className="font-bold text-white text-[11px] uppercase tracking-wide flex items-center gap-1">
              Lobby Players ({lobbyPlayers.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 py-1 custom-scrollbar min-h-0">
            {lobbyPlayers.map((p: any) => {
              let locName = 'Lobby';
              try {
                 const srv = new URLSearchParams(window.location.search).get('server') || 'dungeondelver';
                 locName = srv.charAt(0).toUpperCase() + srv.slice(1);
              } catch (e) {}

              return (
                <div key={p.id} className="flex items-center justify-between bg-black/10 p-1.5 border border-black/15 hover:bg-black/20 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 bg-[#C6895C] border border-black/30 shrink-0">
                      <svg width="100%" height="100%" viewBox="0 0 8 8" shapeRendering="crispEdges">
                        <rect x="0" y="0" width="8" height="8" fill={p.avatarColor || '#C6895C'} />
                        <rect x="2" y="2" width="4" height="2" fill="#4B2D10" />
                        <rect x="2" y="4" width="1" height="1" fill="#5555FF" />
                        <rect x="5" y="4" width="1" height="1" fill="#5555FF" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex flex-col items-start text-left">
                      <span className="text-white text-xs font-bold truncate leading-none mb-0.5 uppercase text-left">{p.name || 'Anonymous Player'}</span>
                      <span className="text-[9px] text-green-300/80 truncate truncate tracking-wide text-left">
                        {p.isDead ? 'Spectating 💀' : `Connected to ${locName}`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                        networkManager.sendFriendRequest(p.name);
                        useGameStore.getState().addChatMessage("System", `§eFriend request sent to ${p.name}`);
                    }}
                    className="p-1 hover:bg-green-500/20 text-green-300 hover:text-green-200 transition-colors rounded-sm ml-1 shrink-0"
                    title="Send Friend Request"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {lobbyPlayers.length === 0 && (
              <div className="text-white/30 text-[9px] italic text-center py-2">No other players in this lobby...</div>
            )}
          </div>

          <form onSubmit={handleAddFriendSubmit} className="mt-2 flex gap-1 pt-1.5 border-t border-black/15 shrink-0">
            <input
              type="text"
              value={newFriendName}
              onChange={(e) => setNewFriendName(e.target.value)}
              maxLength={15}
              placeholder="Friend name..."
              className="flex-1 bg-[#A3A3A3] text-white border-2 border-black/30 px-1 text-xs placeholder-white/30 rounded-none focus:outline-none focus:border-white uppercase text-center"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs font-bold border-2 border-black/30 uppercase leading-none"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
