import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import CallModal from './CallModal';
import GameModal from './GameModal';
import ProfileSettings from './ProfileSettings';

const SOCKET_URL = 'http://localhost:5000';

export default function ChatInterface({ currentUser, onLogout }) {
  const [socket, setSocket]             = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  // ── Local current user ─────────────────────────────────────────────────────
  const [localCurrentUser, setLocalCurrentUser] = useState(currentUser);
  const [showProfile, setShowProfile] = useState(false);

  const handleUpdateUser = (updated) => {
    localStorage.setItem('chatUser', JSON.stringify(updated));
    setLocalCurrentUser(updated);
  };

  // ── Mobile view toggle ─────────────────────────────────────────────────────
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  // ── Global call state ─────────────────────────────────────────────────────
  const [activeCall, setActiveCall] = useState(null);

  // ── Global game state ──────────────────────────────────────────────────────
  const [showGame, setShowGame]     = useState(false);
  const [gameStatus, setGameStatus] = useState('idle');
  const [gameData, setGameData]     = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [isWaiting, setIsWaiting]   = useState(false);
  const [gameError, setGameError]   = useState('');
  const [gameRequest, setGameRequest] = useState(null);

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);
    s.on('connect', () => s.emit('join', localCurrentUser._id));
    s.on('online_users', (ids) => setOnlineUserIds(new Set(ids)));
    s.on('call_incoming', ({ callerId, callerName, callerPhoto, type }) => {
      setActiveCall({ type: 'incoming', callType: type, withUser: { _id: callerId, username: callerName, profilePhoto: callerPhoto } });
    });
    s.on('game_request', (req) => setGameRequest(req));
    return () => s.close();
  }, [localCurrentUser._id]);

  // ── Game socket handlers ───────────────────────────────────────────────────
  const handleGameCreated = useCallback(() => { setGameStatus('created'); setGameError(''); }, []);
  const handleGameStarted = useCallback((state) => {
    setGameStatus('in_progress'); setGameData(state);
    setLastResult(null); setIsWaiting(false); setGameError(''); setShowGame(true);
  }, []);
  const handleGameWaiting = useCallback(() => { setIsWaiting(true); setGameError(''); }, []);
  const handleGameUpdate  = useCallback(({ roundResult, session }) => {
    setIsWaiting(false); setLastResult(roundResult);
    if (session?.scores) {
      setGameData(prev => prev ? { ...prev, scores: Object.fromEntries(session.scores), round: session.round } : prev);
    }
    if (roundResult.matchOver) setGameStatus('finished');
    setShowGame(true);
  }, []);
  const handleGameError = useCallback((msg) => { setGameError(msg); setIsWaiting(false); }, []);

  const gameHandlers = {
    _created: handleGameCreated, _started: handleGameStarted,
    _waiting: handleGameWaiting, _update: handleGameUpdate, _error: handleGameError,
  };

  const handleGameAction = (action) => {
    if (!socket) return;
    setGameError('');
    if (action === '__start')      socket.emit('game_start', { userId: localCurrentUser._id, opponentId: selectedUser._id });
    else if (action === '__join')  socket.emit('game_join',  { userId: localCurrentUser._id });
    else { setIsWaiting(true); socket.emit('game_move', { userId: localCurrentUser._id, move: action }); }
  };

  const handleGameReset = () => {
    setGameStatus('idle'); setGameData(null); setLastResult(null);
    setIsWaiting(false); setGameError('');
  };

  const handleCallUser = (type) => {
    if (!selectedUser || !socket) return;
    socket.emit('call_initiate', { callerId: localCurrentUser._id, calleeId: selectedUser._id, type });
    setActiveCall({ type: 'outgoing', callType: type, withUser: selectedUser });
  };

  const toggleGame = () => { setGameError(''); setShowGame(v => !v); };

  const acceptGameRequest = () => {
    if (!gameRequest || !socket) return;
    const fromUser = { _id: gameRequest.fromUserId, username: gameRequest.fromUserName };
    
    abandonActiveGame();
    setSelectedUser(fromUser);
    setMobileView('chat');
    setShowGame(true);
    handleGameReset();
    socket.emit('game_join', { userId: localCurrentUser._id });
    setGameRequest(null);
  };

  const abandonActiveGame = () => {
    if (socket && (gameStatus === 'created' || gameStatus === 'in_progress')) {
      socket.emit('game_abandon', { userId: localCurrentUser._id });
    }
    handleGameReset();
    setShowGame(false);
  };

  const handleSelectUser = (u) => {
    if (selectedUser && u._id !== selectedUser._id) abandonActiveGame();
    setSelectedUser(u);
    setMobileView('chat');
  };

  const handleMobileBack = () => {
    abandonActiveGame();
    setMobileView('list');
  };

  return (
    <div className="flex flex-row w-full h-full bg-white overflow-hidden">
      {/* ── Sidebar / Chat List ── */}
      {/* On mobile: show only if mobileView==='list' */}
      <div className={`
        flex-shrink-0 flex flex-col bg-white border-r border-gray-200
        w-full md:w-[350px] lg:w-[380px] relative
        ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
      `}>
        {showProfile ? (
          <ProfileSettings
            currentUser={localCurrentUser}
            onUpdateUser={handleUpdateUser}
            onClose={() => setShowProfile(false)}
          />
        ) : (
          <ChatList
            currentUser={localCurrentUser}
            socket={socket}
            onSelectUser={handleSelectUser}
            selectedUser={selectedUser}
            onLogout={onLogout}
            onlineUserIds={onlineUserIds}
            onOpenProfile={() => setShowProfile(true)}
          />
        )}
      </div>

      {/* ── Chat area ── */}
      <div className={`
        flex-1 flex flex-col bg-[#efeae2] min-w-0
        ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
      `}>
        {selectedUser ? (
          <ChatWindow
            currentUser={localCurrentUser}
            selectedUser={selectedUser}
            socket={socket}
            isOnline={onlineUserIds.has(selectedUser._id)}
            lastSeen={selectedUser.last_seen}
            onCallUser={handleCallUser}
            showGame={showGame}
            onToggleGame={toggleGame}
            onMobileBack={handleMobileBack}
          />
        ) : (
          /* Empty state — only visible on desktop */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center bg-[#f8f9fa] border-b-[6px] border-[#25D366] select-none">
            <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-6">
              <span className="text-4xl">💬</span>
            </div>
            <h1 className="text-2xl font-light text-[#41525d] mb-2">WhatsApp Web Clone</h1>
            <p className="text-[#667781] text-sm max-w-xs leading-relaxed">
              Send and receive messages without keeping your phone online.<br />
              <span className="mt-1 block text-[#25D366] font-medium">Select a chat to get started →</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Call Modal ── */}
      {activeCall && (
        <CallModal call={activeCall} currentUser={localCurrentUser} socket={socket} onClose={() => setActiveCall(null)} />
      )}

      {/* ── Game Modal ── */}
      {showGame && selectedUser && (
        <GameModal
          currentUser={localCurrentUser}
          selectedUser={selectedUser}
          socket={socket}
          onClose={() => setShowGame(false)}
          gameStatus={gameStatus}
          gameData={gameData}
          lastResult={lastResult}
          isWaiting={isWaiting}
          gameError={gameError}
          onStart={gameHandlers}
          onMove={handleGameAction}
          onReset={handleGameReset}
        />
      )}

      {/* ── Game Request Notification ── */}
      {gameRequest && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-[90%] sm:w-80 animate-slide-down">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl shrink-0">
              🎮
            </div>
            <div>
              <p className="text-[#111b21] font-semibold text-sm leading-tight">{gameRequest.fromUserName}</p>
              <p className="text-gray-500 text-xs">Wants to play Rock Paper Scissors!</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setGameRequest(null)}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition active:scale-95"
            >
              Decline
            </button>
            <button
              onClick={acceptGameRequest}
              className="flex-1 py-2 rounded-xl bg-[#25D366] text-white font-semibold text-sm hover:bg-[#20b858] transition active:scale-95 shadow-md shadow-green-200"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
