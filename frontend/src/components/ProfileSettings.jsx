import { useState, useRef } from 'react';
import axios from 'axios';
import { ArrowLeft, Camera, Edit2, Check, Loader2 } from 'lucide-react';

export default function ProfileSettings({ currentUser, onUpdateUser, onClose }) {
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio]           = useState(currentUser.bio || 'Hey there! I am using WhatsApp Web Clone.');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio]   = useState(false);
  
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const fileInputRef            = useRef(null);

  const saveProfile = async (updates) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.patch(`http://localhost:5000/api/users/${currentUser._id}/profile-update`, updates);
      onUpdateUser(data); // update local state in App or ChatInterface
      // Re-update local inputs just in case formatting changed
      setUsername(data.username);
      setBio(data.bio);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    if (username.trim() && username !== currentUser.username) {
      saveProfile({ username });
    } else {
      setUsername(currentUser.username);
    }
  };

  const handleBioSave = () => {
    setIsEditingBio(false);
    if (bio.trim() && bio !== currentUser.bio) {
      saveProfile({ bio });
    } else {
      setBio(currentUser.bio || 'Hey there! I am using WhatsApp Web Clone.');
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Read and compress image
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // compress to 80% quality jpeg
        saveProfile({ profilePhoto: dataUrl });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="w-full h-full bg-[#f0f2f5] flex flex-col absolute inset-0 z-50 overflow-y-auto animate-slide-in-left">
      {/* Header */}
      <div className="bg-[#008069] text-white flex items-end px-4 pb-4 pt-16 min-h-[105px] shadow-sm shrink-0">
        <button onClick={onClose} className="mr-6 hover:bg-white/10 p-2 rounded-full transition active:scale-95">
          <ArrowLeft size={24} />
        </button>
        <span className="text-xl font-semibold">Profile</span>
      </div>

      {loading && (
        <div className="absolute top-0 left-0 w-full h-1 bg-[#008069]/20 overflow-hidden">
          <div className="h-full bg-[#25D366] w-1/3 animate-progress" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 text-sm font-medium text-center">
          {error}
        </div>
      )}

      {/* Picture Section */}
      <div className="flex justify-center py-7 bg-[#f0f2f5]">
        <div 
          className="relative w-48 h-48 rounded-full bg-gray-200 cursor-pointer group shadow-md flex items-center justify-center overflow-hidden"
          onClick={() => fileInputRef.current?.click()}
        >
          {currentUser.profilePhoto ? (
            <img src={currentUser.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl text-white font-bold">{currentUser.username[0]?.toUpperCase()}</span>
          )}
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={28} className="text-white mb-2" />
            <span className="text-white text-xs text-center px-4 font-medium uppercase tracking-wider">Change Profile Photo</span>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          {loading && <div className="absolute inset-0 bg-white/50 flex items-center justify-center"><Loader2 className="animate-spin text-[#008069]" size={32} /></div>}
        </div>
      </div>

      {/* Username Section */}
      <div className="bg-white px-7 py-4 shadow-sm mb-3">
        <p className="text-[#008069] text-sm font-medium mb-3 tracking-wide">Your name</p>
        <div className="flex items-center justify-between border-b-2 border-transparent focus-within:border-[#008069] transition-colors pb-1">
          {isEditingName ? (
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              className="flex-1 bg-transparent text-[17px] outline-none text-[#111b21]"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleNameSave()}
            />
          ) : (
            <span className="flex-1 text-[17px] text-[#111b21] py-1">{currentUser.username}</span>
          )}
          <button 
            className="p-1 text-gray-500 hover:text-[#008069] transition"
            onClick={isEditingName ? handleNameSave : () => setIsEditingName(true)}
          >
            {isEditingName ? <Check size={20} /> : <Edit2 size={18} />}
          </button>
        </div>
        <p className="text-[13px] text-gray-500 mt-4 leading-relaxed">
          This is not your username or pin. This name will be visible to your WhatsApp contacts.
        </p>
      </div>

      {/* About Section */}
      <div className="bg-white px-7 py-4 shadow-sm mb-4">
        <p className="text-[#008069] text-sm font-medium mb-3 tracking-wide">About</p>
        <div className="flex items-center justify-between border-b-2 border-transparent focus-within:border-[#008069] transition-colors pb-1">
          {isEditingBio ? (
            <input 
              type="text" 
              value={bio} 
              onChange={e => setBio(e.target.value)}
              className="flex-1 bg-transparent text-[16px] outline-none text-[#111b21]"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleBioSave()}
            />
          ) : (
            <span className="flex-1 text-[16px] text-[#111b21] py-1 truncate pr-4">{currentUser.bio || 'Hey there! I am using WhatsApp Web Clone.'}</span>
          )}
          <button 
            className="p-1 text-gray-500 hover:text-[#008069] transition shrink-0"
            onClick={isEditingBio ? handleBioSave : () => setIsEditingBio(true)}
          >
            {isEditingBio ? <Check size={20} /> : <Edit2 size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
