import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function CreateChannelModal({ serverId, onClose, onChannelCreated }) {
  const [channelName, setChannelName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Format the channel name (lowercase, replace spaces with dashes)
    const formattedName = channelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!formattedName) return;
    
    setIsCreating(true);

    try {
      const docRef = await addDoc(collection(db, 'channels'), {
        serverId: serverId,
        name: formattedName,
        createdAt: serverTimestamp()
      });

      onChannelCreated({ 
        id: docRef.id, 
        name: formattedName 
      });
      
    } catch (error) {
      console.error("Error creating channel:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="bg-[#1e1f22] w-full max-w-md rounded-lg shadow-2xl z-10 overflow-hidden border border-white/10 relative text-center">
        <div className="p-6">
          <h2 className="text-2xl font-extrabold text-white mb-2 text-left">Create Channel</h2>
          <p className="text-gray-400 text-sm mb-6 text-left">in Text Channels</p>
          
          <form onSubmit={handleSubmit} className="text-left">
            <label className="block text-[#b5bac1] text-xs font-bold mb-2 uppercase tracking-wide">
              Channel Name
            </label>
            <div className="relative flex items-center bg-[#111214] rounded mb-6 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
              <span className="absolute left-3 text-gray-500 font-light text-xl">#</span>
              <input 
                type="text" 
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="new-channel"
                className="w-full bg-transparent text-[#f2f3f5] p-3 pl-8 border-none focus:outline-none"
                maxLength="30"
                autoFocus
              />
            </div>
            
            <div className="flex justify-between items-center mt-4 border-t border-white/5 pt-4">
              <button 
                type="button" 
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isCreating || !channelName.trim()}
                className="bg-blue-600 text-white font-medium py-2 px-6 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}