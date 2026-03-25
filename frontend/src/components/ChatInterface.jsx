import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import CallModal from './CallModal';
import GameModal from './GameModal';

const SOCKET_URL = 'http://localhost:5000';

export default function ChatInterface({ currentUser, onLogout }) {
  const [socket, setSocket]             = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

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

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);
    s.on('connect', () => s.emit('join', currentUser._id));
    s.on('online_users', (ids) => setOnlineUserIds(new Set(ids)));
    s.on('call_incoming', ({ callerId, callerName, type }) => {
      setActiveCall({ type: 'incoming', callType: type, withUser: { _id: callerId, username: callerName } });
    });
    return () => s.close();
  }, [currentUser]);

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
    if (action === '__start')      socket.emit('game_start', { userId: currentUser._id });
    else if (action === '__join')  socket.emit('game_join',  { userId: currentUser._id });
    else { setIsWaiting(true); socket.emit('game_move', { userId: currentUser._id, move: action }); }
  };

  const handleGameReset = () => {
    setGameStatus('idle'); setGameData(null); setLastResult(null);
    setIsWaiting(false); setGameError('');
  };

  const handleCallUser = (type) => {
    if (!selectedUser || !socket) return;
    socket.emit('call_initiate', { callerId: currentUser._id, calleeId: selectedUser._id, type });
    setActiveCall({ type: 'outgoing', callType: type, withUser: selectedUser });
  };

  const toggleGame = () => { setGameError(''); setShowGame(v => !v); };

  // ── Abandon game helper ─────────────────────────────────────────────────────
  const abandonActiveGame = () => {
    if (socket && (gameStatus === 'created' || gameStatus === 'in_progress')) {
      socket.emit('game_abandon', { userId: currentUser._id });
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
        w-full md:w-[350px] lg:w-[380px]
        ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
      `}>
        <ChatList
          currentUser={currentUser}
          socket={socket}
          onSelectUser={handleSelectUser}
          selectedUser={selectedUser}
          onLogout={onLogout}
          onlineUserIds={onlineUserIds}
        />
      </div>

      {/* ── Chat area ── */}
      <div className={`
        flex-1 flex flex-col bg-[#efeae2] min-w-0
        ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
      `}>
        {selectedUser ? (
          <ChatWindow
            currentUser={currentUser}
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
        <CallModal call={activeCall} currentUser={currentUser} socket={socket} onClose={() => setActiveCall(null)} />
      )}

      {/* ── Game Modal ── */}
      {showGame && selectedUser && (
        <GameModal
          currentUser={currentUser}
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
    </div>
  );
}
