import { useState } from 'react';
import axios from 'axios';
import { MessageCircle, Loader2 } from 'lucide-react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post('http://localhost:5000/api/users', {
        username: username.trim()
      });
      onLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-[#128C7E] via-[#25D366] to-[#075e54] px-4">
      {/* Background decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full bg-white/5" />
      </div>

      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#25D366] to-[#128C7E]" />

        <div className="px-8 pt-8 pb-10">
          {/* Logo / Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-full flex items-center justify-center shadow-lg shadow-green-300/40 mb-4">
              <MessageCircle size={38} className="text-white" strokeWidth={1.8} />
            </div>
            <h1 className="text-2xl font-bold text-[#111b21]">WhatsApp Web</h1>
            <p className="text-sm text-gray-400 mt-1 text-center">
              Enter a username to start chatting
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#f0f2f5] border-2 border-transparent rounded-xl
                  focus:border-[#25D366] focus:bg-white outline-none text-[15px] text-[#111b21]
                  placeholder:text-gray-300 transition-all"
                placeholder="e.g. John Doe"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <span className="text-red-400 shrink-0">⚠️</span>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-[#25D366] to-[#20b858]
                hover:from-[#20b858] hover:to-[#128C7E]
                disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed
                text-white font-bold text-[15px] rounded-xl
                shadow-md shadow-green-200
                transition-all duration-200 active:scale-[0.98]
                flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Connecting…
                </>
              ) : (
                'Start Chatting →'
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-300 mt-6">
            🔒 Your messages are end-to-end encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
