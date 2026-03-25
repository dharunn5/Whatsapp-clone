import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Paperclip, Phone, Video, Gamepad2, ArrowLeft, X } from 'lucide-react';

export default function ChatWindow({
  currentUser, selectedUser, socket, isOnline, lastSeen,
  onCallUser, showGame, onToggleGame, onMobileBack
}) {
  const [messages, setMessages]     = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading]   = useState(true);
  const messagesEndRef              = useRef(null);
  const fileInputRef                = useRef(null);
  const inputRef                    = useRef(null);

  useEffect(() => {
    if (selectedUser) { setIsLoading(true); fetchMessages(); }
  }, [selectedUser]);

  useEffect(() => {
    if (!socket) return;
    const handler = (message) => {
      const sid = message.sender?._id || message.sender;
      const rid = message.receiver?._id || message.receiver;
      if (
        (sid === currentUser._id && rid === selectedUser._id) ||
        (sid === selectedUser._id && rid === currentUser._id)
      ) setMessages((prev) => [...prev, message]);
    };
    socket.on('receive_message', handler);
    return () => socket.off('receive_message', handler);
  }, [socket, selectedUser, currentUser._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data } = await axios.get(
        `http://localhost:5000/api/messages/${currentUser._id}/${selectedUser._id}`
      );
      setMessages(data);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    socket.emit('send_message', {
      sender: currentUser._id,
      receiver: selectedUser._id,
      text: newMessage.trim(),
    });
    setNewMessage('');
    inputRef.current?.focus();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('file_upload', {
        userId: currentUser._id,
        receiverId: selectedUser._id,
        file: {
          type: file.type.split('/')[0],
          url: reader.result,
          filename: file.name,
          size: file.size,
        },
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const formatTime = (ds) =>
    new Date(ds).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (ds) => {
    const d = new Date(ds);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatLastSeen = (ls) => {
    if (!ls) return 'offline';
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

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const dateKey = msg.createdAt ? formatDate(msg.createdAt) : 'Today';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-[#efeae2] relative w-full overflow-hidden">
      {/* ── Header ── */}
      <div className="bg-[#f0f2f5] flex items-center px-2 sm:px-4 py-2 min-h-[60px] shadow-sm z-10 gap-1">
        {/* Back button — mobile only */}
        <button
          onClick={onMobileBack}
          className="md:hidden p-2 rounded-full text-gray-500 hover:bg-gray-200 active:bg-gray-300 transition mr-1"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>

        {/* Avatar */}
        <div className="relative mr-2 shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#25D366]/30 to-[#128C7E]/20 flex items-center justify-center">
            <span className="font-bold text-[#128C7E] text-sm uppercase">{selectedUser.username[0]}</span>
          </div>
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#25D366] rounded-full border-2 border-[#f0f2f5]" />
          )}
        </div>

        {/* Name / status */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-semibold text-[#111b21] text-[15px] truncate leading-tight">{selectedUser.username}</span>
          <span className={`text-xs leading-tight ${isOnline ? 'text-[#25D366]' : 'text-gray-400'}`}>
            {isOnline ? 'online' : formatLastSeen(lastSeen)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onToggleGame}
            title="Play RPS"
            className={`p-2 sm:p-2.5 rounded-full transition ${showGame ? 'text-[#25D366] bg-green-100' : 'text-gray-500 hover:text-[#25D366] hover:bg-gray-100'}`}
          >
            <Gamepad2 size={20} />
          </button>
          <button
            onClick={() => onCallUser('audio')}
            title="Audio Call"
            className="p-2 sm:p-2.5 rounded-full text-gray-500 hover:text-[#25D366] hover:bg-gray-100 transition"
          >
            <Phone size={20} />
          </button>
          <button
            onClick={() => onCallUser('video')}
            title="Video Call"
            className="p-2 sm:p-2.5 rounded-full text-gray-500 hover:text-[#25D366] hover:bg-gray-100 transition"
          >
            <Video size={20} />
          </button>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div
        className="flex-1 overflow-y-auto py-4 px-3 sm:px-6 space-y-1"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {isLoading ? (
          <div className="flex flex-col gap-4 pt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`h-10 rounded-2xl animate-pulse bg-white/70 ${i % 2 === 0 ? 'w-40' : 'w-52'}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 select-none">
            <div className="w-16 h-16 rounded-full bg-white/60 flex items-center justify-center shadow-sm">
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-sm text-[#667781] text-center">
              Say hello to <b className="text-[#111b21]">{selectedUser.username}</b>!<br />
              <span className="text-xs text-gray-400">Messages are end-to-end encrypted</span>
            </p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-3">
                <span className="bg-[#d1d7db]/80 backdrop-blur-sm text-[#667781] text-[11px] font-medium px-3 py-1 rounded-full shadow-sm">
                  {date}
                </span>
              </div>
              {msgs.map((msg, index) => {
                const sid = msg.sender?._id || msg.sender;
                const isSender = sid === currentUser._id;
                return (
                  <div key={msg._id || index} className={`flex mb-1 ${isSender ? 'justify-end' : 'justify-start'}`}>
                    <div className={`
                      relative max-w-[80%] sm:max-w-[65%] rounded-2xl px-3 py-2 shadow-sm
                      ${isSender
                        ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none'
                        : 'bg-white text-[#111b21] rounded-tl-none'
                      }
                    `}>
                      {msg.fileData ? (
                        <div>
                          {msg.fileData.type === 'image' ? (
                            <img
                              src={msg.fileData.url}
                              alt={msg.fileData.filename}
                              className="max-w-full rounded-xl max-h-60 object-cover mb-1"
                            />
                          ) : msg.fileData.type === 'audio' ? (
                            <audio controls src={msg.fileData.url} className="max-w-full" />
                          ) : (
                            <div className="flex items-center gap-2 bg-gray-100/80 rounded-xl px-3 py-2 my-1">
                              <span className="text-xl">📎</span>
                              <span className="text-sm truncate max-w-[150px]">{msg.fileData.filename}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="break-words leading-relaxed text-[14.5px] pr-10">{msg.text}</p>
                      )}
                      <span className="absolute bottom-1.5 right-2.5 text-[10px] text-gray-400 whitespace-nowrap select-none">
                        {msg.createdAt ? formatTime(msg.createdAt) : ''}
                        {isSender && <span className="ml-1 text-[#53bdeb]">✓✓</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="bg-[#f0f2f5] px-2 sm:px-4 py-2.5 flex items-center gap-1 sm:gap-2 min-h-[62px] z-10 border-t border-gray-200">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload}
          accept="image/*,audio/*,.pdf,.doc,.docx,.txt" />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          className="p-2.5 rounded-full text-gray-500 hover:text-[#25D366] hover:bg-gray-200 active:bg-gray-300 transition shrink-0"
        >
          <Paperclip size={20} />
        </button>
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2 min-w-0">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-white rounded-full px-4 py-2.5 outline-none text-[15px] focus:ring-2 focus:ring-[#25D366]/30 shadow-sm placeholder:text-gray-400 min-w-0"
            placeholder="Type a message"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className={`p-2.5 rounded-full transition shrink-0 ${
              newMessage.trim()
                ? 'bg-[#25D366] text-white hover:bg-[#20b858] shadow-md active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
