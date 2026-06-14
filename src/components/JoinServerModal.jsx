import React, { useState } from 'react';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

export default function JoinServerModal({ user, onClose, onJoined }) {
  const [inviteLink, setInviteLink] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    
    // Extract the server ID whether they pasted a full URL or just the ID
    let serverId = inviteLink.trim();
    if (serverId.includes('?invite=')) {
      serverId = serverId.split('?invite=')[1];
    }
    
    if (!serverId) return;
    setIsJoining(true);

    try {
      // 1. Check if the server actually exists
      const serverRef = doc(db, 'servers', serverId);
      const serverSnap = await getDoc(serverRef);

      if (!serverSnap.exists()) {
        setError('Invalid invite link. Server not found.');
        setIsJoining(false);
        return;
      }

      // 2. The Magic Command: arrayUnion
      // This safely adds the user to the array WITHOUT overwriting anyone else.
      // If they are already in the array, Firebase ignores it (no duplicates!).
      await updateDoc(serverRef, {
        members: arrayUnion(user.uid)
      });

      // 3. Pass the new server data back to the app to update the UI
      onJoined({ id: serverSnap.id, ...serverSnap.data() });
      
    } catch (err) {
      console.error("Error joining server:", err);
      setError('Something went wrong.');
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="bg-[#1e1f22] w-full max-w-md rounded-lg shadow-2xl z-10 overflow-hidden border border-white/10 relative text-center">
        <div className="p-6">
          <h2 className="text-2xl font-extrabold text-white mb-2 text-left">Join a Server</h2>
          <p className="text-gray-400 text-sm mb-6 text-left">Enter an invite link below to join an existing server.</p>
          
          <form onSubmit={handleJoin} className="text-left">
            <label className="block text-[#b5bac1] text-xs font-bold mb-2 uppercase tracking-wide">
              Invite Link or Server ID
            </label>
            <input 
              type="text" 
              value={inviteLink}
              onChange={(e) => setInviteLink(e.target.value)}
              placeholder="https://cipher.com/?invite=abc123xyz"
              className="w-full bg-[#111214] text-[#f2f3f5] p-3 rounded border border-transparent focus:outline-none focus:border-blue-500 transition-all mb-2"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
            
            <div className="flex justify-between items-center mt-6 border-t border-white/5 pt-4">
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                Back
              </button>
              <button 
                type="submit" 
                disabled={isJoining || !inviteLink.trim()}
                className="bg-[#5865f2] text-white font-medium py-2 px-6 rounded hover:bg-[#4752c4] transition-colors disabled:opacity-50"
              >
                {isJoining ? 'Joining...' : 'Join Server'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}