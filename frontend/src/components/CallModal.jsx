/**
 * CallModal.jsx — Full-screen overlay for simulated audio/video calls.
 */
import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';

export default function CallModal({ call, currentUser, socket, onClose }) {
  const [status, setStatus] = useState(call.type === 'incoming' ? 'ringing' : 'calling');
  const [seconds, setSeconds] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (status !== 'active') return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (call.type !== 'outgoing') return;
    const t = setTimeout(() => {
      setStatus('no_answer');
      setTimeout(onClose, 2000);
    }, 30000);
    return () => clearTimeout(t);
  }, [call.type, onClose]);

  useEffect(() => {
    if (!socket) return;
    
    const onCallResponse = ({ response }) => {
      setStatus(response === 'accept' ? 'active' : 'rejected');
      if (response === 'reject') {
        setTimeout(onClose, 2000);
      }
    };
    
    const onCallEnded = () => {
      setStatus('finished');
      setTimeout(onClose, 2000);
    };

    socket.on('call_response', onCallResponse);
    socket.on('call_ended', onCallEnded);
    
    return () => {
      socket.off('call_response', onCallResponse);
      socket.off('call_ended', onCallEnded);
    };
  }, [socket, onClose]);

  useEffect(() => {
    const isVideoCall = call.callType === 'video';
    if (isVideoCall && (status === 'calling' || status === 'ringing' || status === 'active')) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => console.error('Camera error:', err));
    }
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [call.callType, status]);

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

  const handleEndCall = () => {
    socket.emit('call_end', { opponentId: call.withUser._id });
    onClose();
  };

  const isVideo    = call.callType === 'video';
  const otherName  = call.withUser?.username || 'Unknown';
  const isFinished = status === 'rejected' || status === 'no_answer' || status === 'finished';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`
        w-full sm:w-80 sm:rounded-3xl
        rounded-t-3xl
        bg-gradient-to-b from-[#1a1a2e] to-[#0f3460]
        p-8 text-center shadow-2xl
        border border-white/10
        relative overflow-hidden
      `}>
        {/* Local Video render */}
        {isVideo && !isFinished && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover opacity-60 z-0 pointer-events-none mix-blend-screen"
          />
        )}
        
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
          {/* Pulse ring */}
          {(status === 'calling' || status === 'ringing') && (
            <div className="relative w-24 h-24 mx-auto mb-5">
              {!isVideo && <div className="absolute inset-0 rounded-full bg-[#25D366]/30 animate-ping" />}
              {!isVideo && <div className="absolute inset-1 rounded-full bg-[#25D366]/20 animate-ping" style={{ animationDelay: '0.3s' }} />}
              <div className="relative w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center shadow-lg shadow-green-900/50 outline outline-[3px] outline-white/20 overflow-hidden">
                {call.withUser?.profilePhoto ? (
                  <img src={call.withUser.profilePhoto} alt={otherName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-gray-500">{otherName[0]?.toUpperCase()}</span>
                )}
              </div>
            </div>
          )}

        {status === 'active' && (
          <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-gray-200 flex items-center justify-center shadow-lg shadow-green-900/50 outline outline-[3px] outline-white/20 overflow-hidden">
            {call.withUser?.profilePhoto ? (
              <img src={call.withUser.profilePhoto} alt={otherName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-gray-500">{otherName[0]?.toUpperCase()}</span>
            )}
          </div>
        )}

        {isFinished && (
          <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-gray-700 flex items-center justify-center opacity-60 overflow-hidden">
            {call.withUser?.profilePhoto ? (
              <img src={call.withUser.profilePhoto} alt={otherName} className="w-full h-full object-cover grayscale" />
            ) : (
              <span className="text-4xl font-bold text-white">{otherName[0]?.toUpperCase()}</span>
            )}
          </div>
        )}

        <h2 className="text-white text-xl font-bold mb-1 drop-shadow-md">{otherName}</h2>

        <p className="text-gray-200 text-sm mb-8 drop-shadow-md font-medium">
          {status === 'calling'   && (isVideo ? '📹 Video calling…' : '📞 Calling…')}
          {status === 'ringing'   && (isVideo ? '📹 Incoming video call' : '📞 Incoming call')}
          {status === 'active'    && `${isVideo ? '📹 Video' : '📞 Call'} • ${formatTime(seconds)}`}
          {status === 'rejected'  && '📵 Call declined'}
          {status === 'no_answer' && '📵 No answer'}
          {status === 'finished'  && '📞 Call ended'}
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
              onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition shadow-lg shadow-red-900/40"
            >
              <PhoneOff size={26} className="text-white" />
            </button>
            <span className="text-gray-200 drop-shadow-sm font-medium text-xs">End call</span>
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
    </div>
  );
}
