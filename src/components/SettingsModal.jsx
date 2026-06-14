import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function SettingsModal({ user, onClose, onLogout }) {
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    const fetchSessionInfo = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().currentSession) {
        setSessionData(userDoc.data().currentSession);
      }
    };
    fetchSessionInfo();
  }, [user.uid]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="bg-[#1e1f22] w-full max-w-md rounded-lg shadow-2xl z-10 overflow-hidden border border-white/10 relative">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 relative">
          <h2 className="text-xl font-bold text-white">My Account</h2>
          <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Profile Overview */}
          <div className="flex items-center space-x-4 bg-[#111214] p-4 rounded-lg border border-white/5">
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xl uppercase">
              {user.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">{user.name}</h3>
              <p className="text-sm text-gray-400 font-bold">@{user.username || 'guest_username'}</p>
              <p className="text-sm text-gray-400">{user.email || 'Guest Account'}</p>
              <div className="mt-1 inline-block px-2 py-0.5 bg-[#2b2d31] rounded text-xs font-semibold text-blue-400">
                {user.rank}
              </div>
            </div>
          </div>

          {/* Active Session Info */}
          <div>
            <h4 className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider mb-3">Current Session</h4>
            <div className="bg-[#111214] p-4 rounded-lg border border-white/5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Device/Browser:</span>
                <span className="text-white truncate w-48 text-right" title={sessionData?.device}>
                  {sessionData ? sessionData.device.split(' ')[0] + ' (Detected)' : 'Loading...'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Logged In:</span>
                <span className="text-white">
                  {sessionData ? new Date(sessionData.timestamp).toLocaleDateString() : 'Loading...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-[#111214] p-4 border-t border-white/5 flex justify-between items-center">
          <p className="text-xs text-gray-500">Revoking will immediately drop your connection.</p>
          <button 
            onClick={onLogout}
            className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded font-medium transition-colors border border-red-500/20 hover:border-red-500"
          >
            Revoke Session
          </button>
        </div>
      </div>
    </div>
  );
}