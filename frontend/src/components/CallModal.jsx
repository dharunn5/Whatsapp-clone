/**
 * CallModal.jsx — Full-screen overlay for simulated audio/video calls.
 */
import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';

export default function CallModal({ call, currentUser, socket, onClose }) {
  const [status, setStatus] = useState(call.type === 'incoming' ? 'ringing' : 'calling');
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status !== 'active') return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (call.type !== 'outgoing') return;
    const t = setTimeout(() => setStatus('no_answer'), 30000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('call_response', ({ response }) => {
      setStatus(response === 'accept' ? 'active' : 'rejected');
    });
    return () => socket.off('call_response');
  }, [socket]);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleAccept = () => {
    socket.emit('call_respond', { calleeId: currentUser._id, response: 'accept' });
    setStatus('active');
  };

  const handleReject = () => {
    socket.emit('call_respond', { calleeId: currentUser._id, response: 'reject' });
    onClose();
  };

  const isVideo    = call.callType === 'video';
  const otherName  = call.withUser?.username || 'Unknown';
  const isFinished = status === 'rejected' || status === 'no_answer';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`
        w-full sm:w-80 sm:rounded-3xl
        rounded-t-3xl
        bg-gradient-to-b from-[#1a1a2e] to-[#0f3460]
        p-8 text-center shadow-2xl
        border border-white/10
      `}>
        {/* Pulse ring */}
        {(status === 'calling' || status === 'ringing') && (
          <div className="relative w-24 h-24 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-[#25D366]/30 animate-ping" />
            <div className="absolute inset-1 rounded-full bg-[#25D366]/20 animate-ping" style={{ animationDelay: '0.3s' }} />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-lg shadow-green-900/50">
              <span className="text-4xl font-bold text-white">{otherName[0]?.toUpperCase()}</span>
            </div>
          </div>
        )}

        {status === 'active' && (
          <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-lg shadow-green-900/50">
            <span className="text-4xl font-bold text-white">{otherName[0]?.toUpperCase()}</span>
          </div>
        )}

        {isFinished && (
          <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-gray-700 flex items-center justify-center opacity-60">
            <span className="text-4xl font-bold text-white">{otherName[0]?.toUpperCase()}</span>
          </div>
        )}

        <h2 className="text-white text-xl font-bold mb-1">{otherName}</h2>

        <p className="text-gray-300 text-sm mb-8">
          {status === 'calling'   && (isVideo ? '📹 Video calling…' : '📞 Calling…')}
          {status === 'ringing'   && (isVideo ? '📹 Incoming video call' : '📞 Incoming call')}
          {status === 'active'    && `${isVideo ? '📹 Video' : '📞 Call'} • ${formatTime(seconds)}`}
          {status === 'rejected'  && '📵 Call declined'}
          {status === 'no_answer' && '📵 No answer'}
        </p>

        {/* Ringing — Accept / Reject */}
        {status === 'ringing' && (
          <div className="flex justify-center gap-10">
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleReject}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition shadow-lg shadow-red-900/40"
              >
                <PhoneOff size={26} className="text-white" />
              </button>
              <span className="text-gray-400 text-xs">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAccept}
                className="w-16 h-16 rounded-full bg-[#25D366] hover:bg-[#20b858] active:scale-95 flex items-center justify-center transition shadow-lg shadow-green-900/40"
              >
                {isVideo ? <Video size={26} className="text-white" /> : <Phone size={26} className="text-white" />}
              </button>
              <span className="text-gray-400 text-xs">Accept</span>
            </div>
          </div>
        )}

        {/* Calling / Active — Hang up */}
        {(status === 'calling' || status === 'active') && (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onClose}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition shadow-lg shadow-red-900/40"
            >
              <PhoneOff size={26} className="text-white" />
            </button>
            <span className="text-gray-400 text-xs">End call</span>
          </div>
        )}

        {/* Finished */}
        {isFinished && (
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gray-700 hover:bg-gray-600 active:scale-95 text-white rounded-full text-sm font-medium transition"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
