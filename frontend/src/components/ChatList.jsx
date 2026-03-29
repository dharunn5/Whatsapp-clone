import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, LogOut, UserCircle, Trophy, X, Medal } from 'lucide-react';

export default function ChatList({ currentUser, socket, onSelectUser, selectedUser, onLogout, onlineUserIds, onOpenProfile }) {
  const [users, setUsers]               = useState([]);
  const [searchQuery, setSearchQuery]   = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [unseenCounts, setUnseenCounts] = useState({});

  useEffect(() => { 
    fetchUsers(); 
    fetchUnseenCounts();
  }, []);

  const fetchUnseenCounts = async () => {
    try {
      const { data } = await axios.get(`http://localhost:5000/api/messages/unseen/${currentUser._id}`);
      setUnseenCounts(data);
    } catch (err) {
      console.error('Error fetching unseen counts:', err);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handleReceive = (msg) => {
      const sid = msg.sender?._id || msg.sender;
      const rid = msg.receiver?._id || msg.receiver;
      if (rid === currentUser._id && (!selectedUser || selectedUser._id !== sid)) {
        setUnseenCounts(prev => ({
          ...prev,
          [sid]: (prev[sid] || 0) + 1
        }));
      }
    };
    socket.on('receive_message', handleReceive);
    return () => socket.off('receive_message', handleReceive);
  }, [socket, selectedUser, currentUser._id]);


  // Re-fetch when online status changes so last_seen is always fresh
  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      // Small delay to let MongoDB write finish before fetch
      setTimeout(fetchUsers, 800);
    };
    socket.on('online_users', refresh);
    return () => socket.off('online_users', refresh);
  }, [socket]);

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('http://localhost:5000/api/users');
      setUsers(data.filter(u => u._id !== currentUser._id));
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data } = await axios.get('http://localhost:5000/api/users/leaderboard');
      setLeaderboard(data.leaderboard);
      setShowLeaderboard(true);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

  const formatLastSeen = (ls) => {
    if (!ls) return 'last seen: unknown';
    const d = new Date(ls);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === today.toDateString()) return `last seen today at ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `last seen ${date} at ${time}`;
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* ── Header ── */}
      <div className="bg-[#f0f2f5] flex items-center justify-between px-4 py-3 min-h-[60px] border-b border-gray-200">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div 
            className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0 cursor-pointer overflow-hidden transition active:scale-95 shadow-sm"
            onClick={onOpenProfile}
            title="Profile details"
          >
            {currentUser.profilePhoto ? (
              <img src={currentUser.profilePhoto} alt="Me" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#25D366] font-bold text-sm uppercase">{currentUser.username[0]}</span>
            )}
          </div>
          <span className="font-semibold text-[#111b21] truncate text-[15px]">{currentUser.username}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={showLeaderboard ? () => setShowLeaderboard(false) : fetchLeaderboard}
            title="Leaderboard"
            className={`p-2.5 rounded-full transition-all ${showLeaderboard ? 'text-[#25D366] bg-green-100' : 'text-gray-500 hover:text-[#25D366] hover:bg-gray-100'}`}
          >
            <Trophy size={19} />
          </button>
          <button
            onClick={onLogout}
            title="Log out"
            className="p-2.5 rounded-full text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={19} />
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-3 py-2 bg-white border-b border-gray-100">
        <div className="bg-[#f0f2f5] flex items-center px-3 py-2 rounded-full gap-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search users…"
            className="bg-transparent border-none outline-none w-full text-sm text-[#111b21] placeholder:text-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Leaderboard panel ── */}
      {showLeaderboard && (
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-b border-yellow-100 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-yellow-500" />
              <span className="font-bold text-sm text-[#111b21]">Leaderboard</span>
            </div>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
            >
              <X size={13} />
            </button>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No games played yet.</p>
          ) : (
            <ol className="space-y-2">
              {leaderboard.map((u, i) => (
                <li key={u._id} className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2 shadow-sm">
                  <Medal size={14} className={medalColors[i] || 'text-gray-400'} />
                  <span className="font-semibold text-[13px] text-[#111b21] flex-1 truncate">{u.username}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    <span className="text-green-600 font-semibold">{u.wins}W</span>
                    {' / '}
                    <span className="text-red-400 font-semibold">{u.losses}L</span>
                    {' / '}
                    <span className="text-gray-500">{u.draws}D</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* ── User list ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded-full w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm text-gray-400">
              {searchQuery ? `No users matching "${searchQuery}"` : 'No other users yet'}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user._id}
              onClick={() => { 
                onSelectUser(user); 
                setShowLeaderboard(false); 
                if (unseenCounts[user._id]) {
                  setUnseenCounts(prev => { const next = { ...prev }; delete next[user._id]; return next; });
                }
              }}
              className={`flex items-center px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 active:bg-gray-100 ${
                selectedUser?._id === user._id
                  ? 'bg-[#f0f2f5]'
                  : 'hover:bg-[#f5f6f6]'
              }`}
            >
              {/* Avatar */}
              <div className="relative mr-3 shrink-0">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                  {user.profilePhoto ? (
                    <img src={user.profilePhoto} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-[#128C7E] text-base uppercase">{user.username[0]}</span>
                  )}
                </div>
                {onlineUserIds?.has(user._id) && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25D366] rounded-full border-2 border-white" />
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h2 className="text-[15px] font-medium text-[#111b21] truncate">{user.username}</h2>
                  {unseenCounts[user._id] ? (
                    <div className="bg-[#25D366] text-white text-[11px] font-bold px-1.5 py-0.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                      {unseenCounts[user._id]}
                    </div>
                  ) : onlineUserIds?.has(user._id) ? (
                    <span className="text-[10px] text-[#25D366] font-semibold shrink-0">Online</span>
                  ) : null}
                </div>
                {onlineUserIds?.has(user._id) ? (
                  // Online: show game stats if available
                  (user.wins > 0 || user.games_played > 0) ? (
                    <p className="text-xs text-gray-400 truncate">
                      🏆 {user.wins}W · {user.losses}L · {user.draws}D
                    </p>
                  ) : (
                    <p className="text-xs text-[#25D366]">online</p>
                  )
                ) : (
                  // Offline: show last seen
                  <p className="text-xs text-gray-400 truncate">
                    {formatLastSeen(user.last_seen)}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
