/**
 * GameModal.jsx — Responsive RPS Game Panel
 * Renders as a bottom-sheet on mobile, floating card on desktop.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const MOVES = [
  { key: 'rock',     emoji: '🪨', label: 'Rock' },
  { key: 'paper',    emoji: '📄', label: 'Paper' },
  { key: 'scissors', emoji: '✂️',  label: 'Scissors' },
];

export default function GameModal({
  currentUser, selectedUser, socket, onClose,
  gameStatus, gameData, lastResult, isWaiting, gameError,
  onStart, onMove, onReset,
}) {
  const [abandonedMsg, setAbandonedMsg] = useState('');
  useEffect(() => {
    if (!socket) return;
    socket.on('game_created',  onStart._created);
    socket.on('game_started',  onStart._started);
    socket.on('game_waiting',  onStart._waiting);
    socket.on('game_update',   onStart._update);
    socket.on('game_error',    onStart._error);

    const handleGameEnded = () => {
      setAbandonedMsg('Opponent left the game.');
      setTimeout(() => {
        setAbandonedMsg('');
        onReset();
        onClose();
      }, 2500);
    };
    socket.on('game_ended', handleGameEnded);

    return () => {
      socket.off('game_created',  onStart._created);
      socket.off('game_started',  onStart._started);
      socket.off('game_waiting',  onStart._waiting);
      socket.off('game_update',   onStart._update);
      socket.off('game_error',    onStart._error);
      socket.off('game_ended',    handleGameEnded);
    };
  }, [socket, onStart, onReset, onClose]);

  const myScore = gameData?.scores?.[currentUser._id] ?? 0;
  const opScore = gameData?.scores?.[selectedUser._id] ?? 0;
  const round   = gameData?.round ?? 1;

  return (
    <>
      {/* Scrim — clicking closes the modal */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Panel — bottom sheet on mobile, card on desktop */}
      <div className="
        fixed z-50 select-none
        bottom-0 left-0 right-0
        sm:bottom-4 sm:right-4 sm:left-auto
        w-full sm:w-[360px]
        rounded-t-3xl sm:rounded-2xl
        shadow-2xl overflow-hidden
        bg-white
        animate-slide-up
      ">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#25D366] to-[#128C7E] px-5 py-4 flex items-center justify-between">
          {/* Drag handle — visible on mobile */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/30 rounded-full sm:hidden" />
          <div className="flex items-center gap-2.5 mt-1 sm:mt-0">
            <span className="text-2xl">🎮</span>
            <div>
              <p className="font-bold text-white text-sm leading-tight">Rock Paper Scissors</p>
              <p className="text-green-100 text-[11px]">Best of 3 · vs {selectedUser.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition mt-1 sm:mt-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] sm:max-h-none overflow-y-auto">
          {/* Abandoned notice */}
          {abandonedMsg && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2.5">
              <span className="text-base">🚪</span>
              <p className="text-orange-600 text-xs font-medium">{abandonedMsg}</p>
            </div>
          )}

          {/* Error */}
          {gameError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
              <span className="text-base">⚠️</span>
              <p className="text-red-600 text-xs font-medium">{gameError}</p>
            </div>
          )}

          {/* IDLE */}
          {gameStatus === 'idle' && (
            <div className="space-y-3">
              <p className="text-center text-sm text-gray-500">
                Challenge <b className="text-[#111b21]">{selectedUser.username}</b> to a match!
              </p>
              <button
                onClick={() => onMove('__start')}
                className="w-full py-3.5 bg-gradient-to-r from-[#25D366] to-[#20b858] hover:opacity-90 text-white rounded-xl font-semibold text-sm shadow-md shadow-green-200 transition-all active:scale-[0.98]"
              >
                🎮 Start New Game
              </button>
              <button
                onClick={() => onMove('__join')}
                className="w-full py-3.5 border-2 border-[#25D366] text-[#25D366] hover:bg-green-50 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
              >
                🔗 Join Existing Game
              </button>
            </div>
          )}

          {/* CREATED */}
          {gameStatus === 'created' && (
            <div className="text-center py-6 space-y-3">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-40" />
                <div className="relative w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-3xl">⏳</div>
              </div>
              <div>
                <p className="font-semibold text-[#111b21] text-sm">Game created!</p>
                <p className="text-xs text-gray-400 mt-1">
                  Ask <b>{selectedUser.username}</b> to open 🎮 and click &quot;Join&quot;
                </p>
              </div>
            </div>
          )}

          {/* IN PROGRESS */}
          {gameStatus === 'in_progress' && (
            <div className="space-y-4">
              {/* Score bar */}
              <div className="bg-gradient-to-r from-green-50 via-gray-50 to-red-50 rounded-2xl p-4 flex items-center justify-between">
                <div className="text-center flex-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">You</p>
                  <p className="text-4xl font-black text-[#25D366] leading-none">{myScore}</p>
                </div>
                <div className="text-center px-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                    <span className="text-xs font-bold text-gray-500">R{round}</span>
                  </div>
                </div>
                <div className="text-center flex-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 truncate">{selectedUser.username}</p>
                  <p className="text-4xl font-black text-red-400 leading-none">{opScore}</p>
                </div>
              </div>

              {/* Last round result */}
              {lastResult && (
                <div className={`rounded-xl px-4 py-3 text-center border text-xs font-medium ${
                  lastResult.roundWinner === currentUser._id
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : lastResult.roundWinner === null
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  <span className="text-base">{lastResult.myMoveEmoji}</span>
                  <span className="text-gray-400 mx-2 text-sm">vs</span>
                  <span className="text-base">{lastResult.opMoveEmoji}</span>
                  <span className="ml-2">
                    {lastResult.roundWinner === currentUser._id && '— You won! 🏆'}
                    {lastResult.roundWinner === null && '— Draw! 🤝'}
                    {lastResult.roundWinner !== currentUser._id && lastResult.roundWinner !== null && '— They won 💀'}
                  </span>
                </div>
              )}

              {/* Move buttons or waiting */}
              {isWaiting ? (
                <div className="flex flex-col items-center gap-2.5 py-4">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">Waiting for opponent's move…</p>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] text-center text-gray-400 font-semibold mb-3 uppercase tracking-wider">Your Move</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {MOVES.map(({ key, emoji, label }) => (
                      <button
                        key={key}
                        onClick={() => onMove(key)}
                        className="group flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 border-gray-100
                          hover:border-[#25D366] hover:bg-green-50 hover:shadow-lg hover:shadow-green-100
                          active:scale-95 active:bg-green-100 transition-all duration-150"
                      >
                        <span className="text-3xl group-hover:scale-110 transition-transform duration-150">{emoji}</span>
                        <span className="text-[11px] font-semibold text-gray-500 group-hover:text-[#25D366]">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FINISHED */}
          {gameStatus === 'finished' && lastResult && (
            <div className="text-center space-y-4 py-4">
              <div className="text-6xl animate-bounce">
                {lastResult.matchWinner === currentUser._id ? '🏆' :
                 lastResult.matchWinner === null ? '🤝' : '💀'}
              </div>
              <div>
                <p className="font-black text-xl text-[#111b21]">
                  {lastResult.matchWinner === currentUser._id ? 'You Win!' :
                   lastResult.matchWinner === null ? 'Draw!' :
                   `${selectedUser.username} Wins!`}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Final Score: <b className="text-[#25D366]">{lastResult.myScore}</b>
                  {' — '}
                  <b className="text-red-400">{lastResult.opScore}</b>
                </p>
              </div>
              <button
                onClick={onReset}
                className="w-full py-3.5 bg-gradient-to-r from-[#25D366] to-[#20b858] hover:opacity-90 text-white rounded-xl font-bold text-sm shadow-md shadow-green-200 transition-all active:scale-[0.98]"
              >
                🔄 Play Again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
