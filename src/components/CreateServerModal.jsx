import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function CreateServerModal({ user, onClose, onServerCreated }) {
  const [serverName, setServerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;
    
    setIsCreating(true);

    try {
      // 1. Create the Server in the database
      const serverRef = await addDoc(collection(db, 'servers'), {
        name: serverName.trim(),
        ownerId: user.uid,
        members: [user.uid], // You are the first member!
        createdAt: serverTimestamp()
      });

      // 2. Automatically generate the default #general channel
      const channelRef = await addDoc(collection(db, 'channels'), {
        serverId: serverRef.id,
        name: 'general',
        createdAt: serverTimestamp()
      });

      // 3. Tell AppShell to update the UI
      onServerCreated({ 
        id: serverRef.id, 
        name: serverName.trim() 
      });
      
    } catch (error) {
      console.error("Error creating server:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="bg-[#1e1f22] w-full max-w-md rounded-lg shadow-2xl z-10 overflow-hidden border border-white/10 relative text-center">
        <div className="p-6">
          <h2 className="text-2xl font-extrabold text-white mb-2">Create a Server</h2>
          <p className="text-gray-400 text-sm mb-6">Your server is where you and your friends hang out. Make yours and start talking.</p>
          
          <form onSubmit={handleSubmit} className="text-left">
            <label className="block text-[#b5bac1] text-xs font-bold mb-2 uppercase tracking-wide">
              Server Name
            </label>
            <input 
              type="text" 
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder={`${user.name}'s Server`}
              className="w-full bg-[#111214] text-[#f2f3f5] p-3 rounded border border-transparent focus:outline-none focus:border-blue-500 transition-all mb-6"
              maxLength="30"
              autoFocus
            />
            
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
                disabled={isCreating || !serverName.trim()}
                className="bg-blue-600 text-white font-medium py-2 px-6 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}