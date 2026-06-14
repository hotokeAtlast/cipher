import React from "react";
import { useEffect, useState, useRef } from "react";
import { socket } from "../socket"; // Import the configured Socket.io client
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  where,
  serverTimestamp,
  setDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

import SettingsModal from "./SettingsModal";
import CreateServerModal from './CreateServerModal';
import CreateChannelModal from './CreateChannelModal';
import JoinServerModal from './JoinServerModal';
import { useToast } from '../context/ToastContext';



export default function AppShell({ user, onLogout }) {
  const { addToast } = useToast();

  const [showSettings, setShowSettings] = useState(false);
  



  // 0. STATE: Hold our messages and the current input text
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
const [channels, setChannels] = useState([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [activeChannel, setActiveChannel] = useState(channels[0]);

  // Are we looking at a Server ('channels') or our DMs ('dms')?
  const [viewMode, setViewMode] = useState('channels'); 
  
  const [activeDm, setActiveDm] = useState(null);


  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [showCreateServer, setShowCreateServer] = useState(false);

const [showJoinServer, setShowJoinServer] = useState(false);


useEffect(() => {
  const fetchServer = async() => {
    try{
      const q = query(
        collection(db, 'servers'),
        where('members', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(q);
      const userServers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data()  }))

      setServers(userServers);
      // auto-selecting the first server (if client has one)
      if(userServers.length > 0 && !activeServer) {
        setActiveServer(userServers[0]);
      }
    } catch(error){
      console.error(`Failed to fetch servers: ${error}`)
    }
  };
  fetchServer();
}, [user.uid]);

// FETCH DIRECT MESSAGES & REQUESTS (REAL-TIME LISTENER)
  useEffect(() => {
    // We removed the viewMode check so it listens in the background 24/7!

    const q = query(
      collection(db, 'relationships'),
      where('participants', 'array-contains', user.uid)
    );

    // onSnapshot attaches a live wire to the database. 
    // Every time a relationship changes, this function automatically re-runs!
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const friends = [];
      const requests = [];

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const otherUserId = data.participants.find(id => id !== user.uid);
        const otherUserProfile = data.profiles[otherUserId];

        // Safety check just in case a document is malformed
        if (!otherUserProfile) return;

        const friendObj = {
          uid: otherUserId,
          name: otherUserProfile.name,
          roomId: docSnap.id,
          status: data.status,
          requester: data.requester
        };

        if (data.status === 'accepted') {
          friends.push(friendObj);
        } else if (data.status === 'pending') {
          requests.push(friendObj);
        }
      });

      setFriendsList(friends);
      setPendingRequests(requests);
    }, (error) => {
      console.error("Failed to fetch DMs in real-time:", error);
    });

    // Cleanup: When the user logs out, disconnect the live wire so we don't leak memory.
    return () => unsubscribe();
  }, [user.uid]);



// FETCH CHANNELS WHEN ACTIVE SERVER CHANGES
  useEffect(() => {
    // If we aren't looking at a server, don't try to fetch channels
    if (!activeServer) return;

    const fetchChannels = async () => {
      try {
        const q = query(
          collection(db, 'channels'),
          where('serverId', '==', activeServer.id),
          orderBy('createdAt', 'asc') // Oldest channels at the top
        );
        
        const snapshot = await getDocs(q);
        const serverChannels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        setChannels(serverChannels);
        
        // Auto-select the first channel if we just switched servers
        if (serverChannels.length > 0) {
          setActiveChannel(serverChannels[0]);
        } else {
          setActiveChannel(null); // No channels exist yet
        }
      } catch (error) {
        console.error("Failed to fetch channels:", error);
      }
    };

    fetchChannels();
  }, [activeServer]);



  // --- SEARCH STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);


  // --- DM INBOX STATE ---
  const [friendsList, setFriendsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    // Don't search if they haven't typed at least 2 letters
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setIsSearching(true);
      try {
        // Firestore Prefix Search Trick (\uf8ff is a very high unicode character)
        const q = query(
          collection(db, 'users'),
          where('username', '>=', searchQuery),
          where('username', '<=', searchQuery + '\uf8ff'),
          limit(5) // Only grab top 5 to save bandwidth
        );
        
        const snapshot = await getDocs(q);
        const results = snapshot.docs
          .map(doc => ({ uid: doc.id, ...doc.data() }))
          // Don't show the user themselves in the search results
          .filter(foundUser => foundUser.uid !== user.uid); 
          
        setSearchResults(results);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };

    // The Debounce: Wait 500ms after they stop typing to run the search
    const delayDebounceFn = setTimeout(() => {
      searchUsers();
    }, 500);

    // Cleanup function: If they type again before 500ms, cancel the previous timer
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, user.uid]);


  // <--- START-DIRECT-MESSAGE --->

// 1. THE INBOX ROUTER
  const startDirectMessage = async (friend) => {
    const roomId = getDmRoomId(user.uid, friend.uid);
    const relRef = doc(db, 'relationships', roomId);
    
    try {
      const relSnap = await getDoc(relRef);
      
      // If no relationship exists yet, create a "Pending Request"
      if (!relSnap.exists()) {
        await setDoc(relRef, {
          participants: [user.uid, friend.uid],
          // We store basic profile data here so we don't have to query the users table again
          profiles: {
            [user.uid]: { name: user.name, rank: user.rank },
            [friend.uid]: { name: friend.name, rank: friend.rank }
          },
          status: 'pending',
          requester: user.uid,
          updatedAt: serverTimestamp()
        });
        addToast(`Request sent to ${friend.name}`, 'success');
      }

      // Switch the UI to their chat
      setActiveDm({ uid: friend.uid, name: friend.name });
      setSearchQuery('');
      setSearchResults([]);
      
    } catch (error) {
      console.error("Error creating DM request:", error);
      addToast("Failed to start conversation", "error");
    }
  };

// THE MAGIC DM ROUTER
  const getDmRoomId = (uid1, uid2) => {
    return 'dm_' + [uid1, uid2].sort().join('_');
  };

  // THE COMPOUND ROOM ID GENERATOR
  // This calculates the exact tunnel/database ID based on what you are looking at
  const currentRoomId = viewMode === 'channels' 
    ? (activeServer && activeChannel ? `server_${activeServer.id}_channel_${activeChannel.id}` : null)
    : (activeDm ? getDmRoomId(user.uid, activeDm.uid) : null);


// 1. DATABASE & NETWORK: Sync on Channel Change
  useEffect(() => {
    if(!currentRoomId) return;

    socket.emit('join_room', currentRoomId);

    // B) Clear the old messages from the screen instantly for snappy UX
    setMessages([]); 

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'messages'), 
          where('room', '==', currentRoomId), 
          orderBy('createdAt', 'asc'), 
          limit(50)
        );
        
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setMessages(history);
      } catch (error) {
        console.error("Error fetching history:", error);
      }
    };

    fetchHistory();
  }, [currentRoomId]);


  // 2. REFS: We'll use this to scroll to the bottom of the chat
  const messagesEndRef = useRef(null);

  // 3. EFFECT: Set up our Socket.io listeners once the component mounts
  useEffect(() => {
    // Listen for incoming messages from the server
    socket.on("receive_message", (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });
    // Clean up the listener when the component unmounts
    return () => {
      socket.off("receive_message");
    };
  }, []);

  //  Scroll to the bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


const handleCopyInvite = () => {
    if (!activeServer) return;
    const inviteLink = `${window.location.origin}/?invite=${activeServer.id}`;
    navigator.clipboard.writeText(inviteLink);
    
    // 3. Swap the alert for the toast!
    // OLD: alert('Invite link copied to clipboard!');
    addToast('Invite link copied to clipboard!', 'success');
  };

  // 5. FUNCTION: Handle sending a new message
  const handleSendMessage = async () => {
    if (currentMessage.trim() !== "") {
      // The exact data packet we are sending and saving
      const messageData = {
        id: Math.random().toString(36).substring(7),
        uid: user.uid,
        user: user,
        text: currentMessage,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        
        // --- THE UPGRADED ROUTING DATA ---
        room: currentRoomId, // e.g., 'server_abc_channel_general' or 'dm_123_456'
        messageType: viewMode, // 'channels' or 'dms'
        serverId: viewMode === 'channels' ? activeServer?.id : null, // Only exists for servers
        
        createdAt: new Date().toISOString(),
      };

      socket.emit("send_message", messageData);
      setCurrentMessage("");

      try {
        await addDoc(collection(db, "messages"), {
          user: user,
          text: messageData.text,
          time: messageData.time,
          room: messageData.room, // This is what our useEffect query uses!
          messageType: messageData.messageType,
          serverId: messageData.serverId,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error writing to database:", error);
      }
    }
  };

  const handleRequestAction = async (roomId, action) => {
    try {
      const relRef = doc(db, 'relationships', roomId);
      if (action === 'accept') {
        await updateDoc(relRef, { status: 'accepted', updatedAt: serverTimestamp() });
        addToast("Request accepted!", "success");
        // Force a quick view change to re-trigger our fetcher
        setViewMode('channels'); setTimeout(() => setViewMode('dms'), 10);
      } else {
        // If they decline, we just delete the relationship document
        // (You'll need to import deleteDoc from firebase/firestore for this!)
        await deleteDoc(relRef); 
        addToast("Request declined.", "info");
        setViewMode('channels'); setTimeout(() => setViewMode('dms'), 10);
      }
    } catch (error) {
      addToast("Action failed.", "error");
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-[#f2f3f5] overflow-hidden font-sans">
      {/* 1. SERVER SIDEBAR (Far Left) - Premium OLED Dark */}
      <div className="w-[72px] bg-[#09090b] flex flex-col items-center py-3 space-y-3 z-20">
        
        {/* Direct Messages Icon */}
        <div className="relative group flex justify-center w-full">
          {/* Highlight pill if in DM mode */}
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r-lg transition-all duration-300 ${viewMode === 'dms' ? 'h-10' : 'h-0 group-hover:h-5'}`}></div>
          
          <button 
            onClick={() => { setViewMode('dms'); setActiveDm(friendsList[0]); }}
            className={`w-12 h-12 text-white rounded-[24px] hover:rounded-[16px] transition-all duration-300 flex items-center justify-center shadow-lg ${viewMode === 'dms' ? 'bg-[#2563eb] rounded-[16px]' : 'bg-[#1d4ed8] hover:bg-[#2563eb]'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
        
        <div className="w-8 h-[2px] bg-white/10 rounded-full my-1"></div>

        {/* Dynamic Server List */}
        {servers.map((server) => {
          const isActive = viewMode === 'channels' && activeServer?.id === server.id;
          return (
            <div key={server.id} className="relative group flex justify-center w-full">
              {/* Highlight pill */}
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r-lg transition-all duration-300 ${isActive ? 'h-10' : 'h-0 group-hover:h-5'}`}></div>
              
              <button 
                onClick={() => {
                  setViewMode('channels');
                  setActiveServer(server);
                }}
                className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-300 flex items-center justify-center font-bold text-lg overflow-hidden ${isActive ? 'bg-[#1d4ed8] text-white rounded-[16px]' : 'bg-[#1e1f22] text-gray-300 hover:bg-[#1d4ed8] hover:text-white'}`}
                title={server.name}
              >
                {/* Grab the first letter of the server name */}
                {server.name.charAt(0).toUpperCase()}
              </button>
            </div>
          );
        })}

        {/* The "Create Server" Button (+) */}
        <button 
          onClick={() => setShowCreateServer(true)}
          className="w-12 h-12 text-[#23a559] bg-[#1e1f22] rounded-[24px] hover:rounded-[16px] hover:bg-[#23a559] hover:text-white transition-all duration-300 flex items-center justify-center font-bold text-2xl shadow-lg mt-2"
          title="Add a Server"
        >
          +
        </button>

        {/* The "Join Server" Button (Compass) */}
        <button 
          onClick={() => setShowJoinServer(true)}
          className="w-12 h-12 text-gray-300 bg-[#1e1f22] rounded-[24px] hover:rounded-[16px] hover:bg-[#1d4ed8] hover:text-white transition-all duration-300 flex items-center justify-center shadow-lg mt-2"
          title="Join a Server"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* 2. CHANNEL SIDEBAR (Middle) - Deep Gray */}
      <div className="w-60 bg-[#111214] flex flex-col z-10 rounded-tl-lg overflow-hidden border-l border-white/5">
        
        {viewMode === 'channels' ? (
          /* --- SERVER/CHANNEL VIEW --- */
          <>
            {/* Server Header */}
            <div 
              onClick={handleCopyInvite}
              className="h-12 border-b border-[#1e1f22] flex items-center justify-between px-4 shadow-sm hover:bg-white/5 cursor-pointer transition-colors group"
              title="Click to copy invite link"
            >
              <h2 className="font-extrabold text-[15px] text-[#f2f3f5] truncate pr-2">
                {activeServer?.name || 'Loading...'}
              </h2>
              {/* Added a subtle "copy" icon hint on hover */}
              <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="flex items-center justify-between text-[#949ba4] text-[11px] font-bold tracking-wider uppercase px-1 pt-3 pb-1 hover:text-gray-300 cursor-pointer group">
              <div className="flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                Text Channels
              </div>
              {/* Add the onClick to this button! */}
              <button onClick={() => setShowCreateChannel(true)} className="hidden group-hover:block hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
              {channels.map((channel) => {
                const isActive = activeChannel?.id === channel.id;
                return (
                  <button 
                    key={channel.id} onClick={() => setActiveChannel(channel)}
                    className={`w-full text-left px-2 py-1.5 mt-0.5 rounded flex items-center group transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-[#949ba4] hover:bg-white/5 hover:text-gray-300'}`}
                  >
                    <span className="font-light text-xl mr-1.5 pb-0.5">#</span>
                    <span className="font-medium">{channel.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* --- DIRECT MESSAGES VIEW --- */
          <>
            {/* The Search Bar Area */}
            <div className="p-3 border-b border-white/5 relative z-20">
              <input 
                type="text" 
                placeholder="Find or start a conversation" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1e1f22] text-xs text-gray-200 px-2.5 py-2 rounded border border-transparent focus:outline-none focus:border-blue-500 placeholder-[#949ba4] transition-all"
              />
              
              {/* The Live Search Results Dropdown */}
              {searchQuery.trim().length >= 2 && (
                <div className="absolute top-full left-3 right-3 mt-1 bg-[#1e1f22] border border-white/10 rounded-md shadow-2xl overflow-hidden animate-fade-in">
                  {isSearching ? (
                    <div className="p-3 text-xs text-gray-400 text-center">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={result.uid}
                        onClick={() => startDirectMessage(result)}
                        className="w-full flex items-center p-2 hover:bg-white/5 transition-colors text-left group"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold uppercase mr-3">
                          {result.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-200 group-hover:text-white leading-tight">
                            {result.name}
                          </span>
                          {/* Added the @username below their display name! */}
                          <span className="text-[11px] text-gray-400 leading-tight mt-0.5">
                            @{result.username}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-xs text-gray-400 text-center">No users found.</div>
                  )}
                </div>
              )}
            </div>
            
            {/* The Inbox Area */}
            <div className="flex-1 overflow-y-auto p-2">
              
              {/* PENDING REQUESTS SECTION */}
              {pendingRequests.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center text-[#949ba4] text-[11px] font-bold tracking-wider uppercase px-1 pt-2 pb-1">
                    Message Requests ({pendingRequests.length})
                  </div>
                  {pendingRequests.map((req) => {
                    const isIncoming = req.requester !== user.uid;
                    
                    return (
                      <div key={req.uid} className="w-full px-2 py-2 mt-0.5 rounded flex flex-col group bg-white/5 border border-white/5">
                        <div className="flex items-center mb-2">
                          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-sm uppercase mr-3">
                            {req.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-300">{req.name}</span>
                        </div>
                        
                        {/* If they sent it to us, show Accept/Decline. If we sent it, show "Pending..." */}
                        {isIncoming ? (
                          <div className="flex space-x-2">
                            <button onClick={() => handleRequestAction(req.roomId, 'accept')} className="flex-1 bg-[#23a559] hover:bg-[#1a7c43] text-white text-xs font-bold py-1.5 rounded transition-colors">
                              Accept
                            </button>
                            <button onClick={() => handleRequestAction(req.roomId, 'decline')} className="flex-1 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white text-xs font-bold py-1.5 rounded transition-colors border border-red-500/30">
                              Block
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 italic text-center w-full">Request Sent...</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ACTIVE FRIENDS SECTION */}
              <div className="flex items-center text-[#949ba4] text-[11px] font-bold tracking-wider uppercase px-1 pt-2 pb-1">
                Direct Messages
              </div>
              {friendsList.map((friend) => {
                const isActive = activeDm?.uid === friend.uid;
                return (
                  <button 
                    key={friend.uid} onClick={() => setActiveDm(friend)}
                    className={`w-full text-left px-2 py-2 mt-0.5 rounded flex items-center group transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-[#949ba4] hover:bg-white/5 hover:text-gray-300'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm uppercase mr-3 relative">
                      {friend.name.charAt(0)}
                    </div>
                    <span className="font-medium">{friend.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* User Profile Bar */}
        <div className="h-[52px] bg-[#09090b] p-1.5 flex items-center justify-between mt-auto border-t border-white/5">
          <div
            onClick={() => setShowSettings(true)}
            className="flex items-center hover:bg-white/5 p-1 rounded cursor-pointer transition-colors w-full"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white uppercase text-sm relative">
              {user.name.charAt(0)}
              {/* Online status indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#09090b]"></div>
            </div>
            <div className="ml-2 flex flex-col overflow-hidden">
              <span className="text-[13px] font-bold text-[#f2f3f5] truncate leading-tight">
                {user.name}
              </span>
              <span className="text-[11px] text-gray-400 truncate leading-tight">
                {user.rank}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN CHAT AREA (Right) */}
      <div className="flex-1 bg-[#18181b] flex flex-col relative">
      
        {/* Top Nav */}
        <div className="h-12 border-b border-white/5 flex items-center px-4 font-semibold text-gray-100 shadow-sm">
          <span className="text-[#80848e] font-light text-2xl mr-2 pb-0.5">
            {viewMode === 'channels' ? '#' : '@'}
          </span>
          {viewMode === 'channels' ? activeChannel?.name : activeDm?.name}
        </div>

        {/* Chat History (MAPPED FROM STATE) */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-start">
          <div className="text-center text-gray-500 text-sm mb-4 mt-auto">
            Welcome to the start of the #general channel.
          </div>

          {/* Loop through our messages array and render them */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="mt-4 hover:bg-[#2b2d31]/30 py-0.5 px-4 -mx-4 rounded group transition-colors"
            >
              <div className="flex items-start">
                {/* A dynamic avatar based on the first letter of their name */}
                <div className="w-10 h-10 rounded-full bg-blue-600 mt-0.5 flex-shrink-0 flex items-center justify-center font-bold text-white uppercase select-none">
                  {msg.user.name.charAt(0)}
                </div>
                <div className="ml-4 flex-1">
                  <span
                    className="font-medium mr-2 hover:underline cursor-pointer"
                    style={{
                      color: msg.user.rank === "Member" ? "#60a5fa" : "#9ca3af",
                    }}
                  >
                    {msg.user.name}
                  </span>
                  <span className="text-xs text-gray-500 select-none">
                    {msg.time}
                  </span>
                  <p className="text-gray-200 mt-0.5 break-words">{msg.text}</p>
                </div>
              </div>
            </div>
          ))}
          {/* Invisible div to help us scroll to the bottom */}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Area */}
        <div className="p-4 pt-0 mt-2">
          <div className="bg-[#2b2d31] rounded-lg flex items-center px-4 py-2.5 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
            <input
              type="text"
              placeholder={`Message ${viewMode === 'channels' ? '#' + activeChannel?.name : '@' + activeDm?.name}`}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1 bg-transparent border-none focus:outline-none text-gray-200 placeholder-[#80848e]"
            />
          </div>
        </div>
      </div>
      {showSettings && (
        <SettingsModal 
          user={user} 
          onClose={() => setShowSettings(false)} 
          onLogout={onLogout} 
        />
      )}
      {showCreateServer && (
        <CreateServerModal 
          user={user} 
          onClose={() => setShowCreateServer(false)} 
          onServerCreated={(newServer) => {
            setServers(prev => [...prev, newServer]);
            setActiveServer(newServer);
            setShowCreateServer(false);
          }}
        />
      )}
      {showCreateChannel && activeServer && (
        <CreateChannelModal 
          serverId={activeServer.id}
          onClose={() => setShowCreateChannel(false)} 
          onChannelCreated={(newChannel) => {
            setChannels(prev => [...prev, newChannel]);
            setActiveChannel(newChannel);
            setShowCreateChannel(false);
          }}
        />
      )}
      {showJoinServer && (
        <JoinServerModal 
          user={user} 
          onClose={() => setShowJoinServer(false)} 
          onJoined={(serverData) => {
            // Check if we are already in the server (just in case)
            if (!servers.find(s => s.id === serverData.id)) {
              setServers(prev => [...prev, serverData]);
            }
            setActiveServer(serverData);
            setViewMode('channels');
            setShowJoinServer(false);
          }}
        />
      )}
    </div>
  );
}
