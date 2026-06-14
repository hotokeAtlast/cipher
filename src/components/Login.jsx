import React, { useState, useEffect } from "react";
import { FaGoogle } from "react-icons/fa";
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile 
} from 'firebase/auth';
import { useToast } from '../context/ToastContext';
import UsernameSetup from './UsernameSetup';

export default function Login({ onLogin }) {
  const { addToast } = useToast();

  // THE TRAPDOOR STATE
  const [pendingUser, setPendingUser] = useState(null);

  const [view, setView] = useState("main"); // 'main', 'email', or 'guest'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [guestName, setGuestName] = useState("");

  // Catch mobile redirects
  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const fbUser = result.user;
          const docRef = doc(db, 'users', fbUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            onLogin({ uid: fbUser.uid, ...docSnap.data() });
          } else {
            setPendingUser({
              uid: fbUser.uid,
              name: fbUser.displayName || 'Anonymous',
              email: fbUser.email,
              role: 'verified',
              rank: 'Member',
              photoUrl: fbUser.photoURL || null
            });
          }
        }
      } catch (error) {
        console.error("Redirect auth error:", error.message);
      }
    };
    checkRedirect();
  }, [onLogin]);

  // THE REGISTRY SYNC
  const syncUserToDatabase = async (userData) => {
    try {
      const deviceInfo = navigator.userAgent;
      const userRef = doc(db, 'users', userData.uid);
      const userSnap = await getDoc(userRef);

      const registryData = {
        name: userData.name,
        username: userData.username,
        email: userData.email || 'N/A', 
        role: userData.role,
        rank: userData.rank,
        photoUrl: userData.photoUrl || 'N/A',
        lastLogin: serverTimestamp(),
        currentSession: {
          device: deviceInfo,
          timestamp: new Date().toISOString(),
        }
      };

      if (!userSnap.exists()) {
        registryData.createdAt = serverTimestamp();
        registryData.messageCountToday = 0; 
        if (userData.role === 'guest') {
          localStorage.setItem('cipher_guest_claim_token', userData.uid);
        }
      }

      await setDoc(userRef, registryData, { merge: true });
      onLogin(userData);

    } catch (error) {
      console.error("Failed to sync user to registry:", error);
      onLogin(userData); 
    }
  };

  // COMBINED GOOGLE LOGIN & TRAPDOOR
  const handleGoogleLogin = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    try {
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
        return; // Redirect handles the reload
      } 
      
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      const docRef = doc(db, 'users', fbUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        onLogin({ uid: fbUser.uid, ...docSnap.data() });
      } else {
        setPendingUser({
          uid: fbUser.uid,
          name: fbUser.displayName || 'Anonymous',
          email: fbUser.email,
          role: 'verified',
          rank: 'Member',
          photoUrl: fbUser.photoURL || null
        });
      }
    } catch (error) {
      addToast(error.message.replace('Firebase: ', ''), 'error');
    }
  };

  // EMAIL AUTH & TRAPDOOR
  const handleEmailAuth = async (e) => {
    e.preventDefault(); 
    try {
      let userCredential;
      let finalName = displayName;

      if (isSignUp) {
        if (!displayName.trim()) return addToast("Please enter a display name!", "error");
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: displayName });
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        finalName = userCredential.user.displayName || "Unknown User";
      }

      const fbUser = userCredential.user;
      const docRef = doc(db, 'users', fbUser.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        onLogin({ uid: fbUser.uid, ...docSnap.data() });
      } else {
        setPendingUser({
          uid: fbUser.uid,
          name: finalName,
          email: fbUser.email,
          role: 'verified',
          rank: 'Member',
          photoUrl: fbUser.photoURL || null
        });
      }

    } catch (error) {
      addToast(error.message.replace('Firebase: ', ''), "error");
    }
  };

  const handleGuestSubmit = async (e) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    
    const existingGuestId = localStorage.getItem('cipher_guest_claim_token');
    const finalUid = existingGuestId || `guest_${Date.now()}`;
    
    const cleanName = guestName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const autoUsername = `guest_${cleanName}_${Math.floor(Math.random() * 1000)}`;

    await syncUserToDatabase({ 
      name: guestName.trim(), 
      uid: finalUid, 
      role: 'guest',
      rank: 'Visitor',
      username: autoUsername 
    });
  };

  // --- TRAPDOOR RENDER ---
  if (pendingUser) {
    return (
      <UsernameSetup 
        pendingUser={pendingUser} 
        onComplete={(finalProfile) => syncUserToDatabase(finalProfile)} 
        onCancel={() => setPendingUser(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      <div className="bg-[#121214] p-8 rounded-lg shadow-2xl w-full max-w-[480px] text-center border border-white/5">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-[#f2f3f5] tracking-wide mb-1">
            Welcome to Cipher
          </h1>
          <p className="text-[#b5bac1] text-sm">
            Secure, real-time communication.
          </p>
        </div>

        {view === "main" && (
          <div className="animate-fade-in">
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-[#2b2d31] text-[#f2f3f5] font-semibold py-3 px-4 rounded transition-all duration-200 hover:bg-[#3f4147] hover:shadow-lg flex items-center justify-center space-x-3 mb-4 group border border-white/5 focus:border-[#5865F2] focus:outline-none"
            >
              <FaGoogle className="w-5 h-5 transition-transform group-hover:scale-110 text-white" />
              <span>Log in with Google</span>
            </button>

            <button
              onClick={() => setView("email")}
              className="w-full bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-medium py-3 px-4 rounded transition-colors duration-200"
            >
              Log in with Email
            </button>

            <div className="flex items-center my-6">
              <div className="flex-grow border-t border-[#3f4147]"></div>
              <span className="px-3 text-[#b5bac1] text-xs font-semibold tracking-wider">
                OR
              </span>
              <div className="flex-grow border-t border-[#3f4147]"></div>
            </div>

            <button
              onClick={() => setView("guest")}
              className="w-full bg-transparent border border-gray-500 text-gray-300 font-semibold py-3 px-4 rounded hover:bg-[#2b2d31] hover:text-white transition-all duration-200"
            >
              Join as Guest
            </button>
          </div>
        )}

        {view === 'email' && (
          <form onSubmit={handleEmailAuth} className="text-left animate-fade-in">
            {isSignUp && (
              <div className="mb-4">
                <label className="block text-[#b5bac1] text-xs font-bold mb-2 uppercase tracking-wide">Display Name</label>
                <input 
                  type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#1e1f22] text-[#f2f3f5] p-2.5 rounded border border-transparent focus:outline-none focus:border-blue-500 focus:bg-[#2b2d31] transition-all"
                  required
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-[#b5bac1] text-xs font-bold mb-2 uppercase tracking-wide">Email</label>
              <input 
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1e1f22] text-[#f2f3f5] p-2.5 rounded border border-transparent focus:outline-none focus:border-blue-500 focus:bg-[#2b2d31] transition-all"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-[#b5bac1] text-xs font-bold mb-2 uppercase tracking-wide">Password</label>
              <input 
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1e1f22] text-[#f2f3f5] p-2.5 rounded border border-transparent focus:outline-none focus:border-blue-500 focus:bg-[#2b2d31] transition-all"
                required minLength="6"
              />
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded hover:bg-blue-700 mb-4 transition-colors">
              {isSignUp ? "Create Account" : "Log In"}
            </button>
            
            <div className="flex justify-between items-center text-sm mt-2">
              <button type="button" onClick={() => setView('main')} className="text-[#b5bac1] hover:text-white hover:underline">
                Back
              </button>
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-[#00a8fc] hover:underline">
                {isSignUp ? "Already have an account?" : "Need an account?"}
              </button>
            </div>
          </form>
        )}

        {view === "guest" && (
          <div className="text-left animate-fade-in">
            <div className="mb-6">
              <label className="block text-[#b5bac1] text-xs font-bold mb-2 uppercase tracking-wide">
                What should we call you?
              </label>
              <input
                type="text"
                placeholder="Enter a display name.."
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGuestSubmit(e)}
                className="w-full bg-[#1e1f22] text-[#f2f3f5] p-3 rounded border border-transparent focus:outline-none focus:border-gray-400 focus:bg-[#2b2d31] transition-all"
                autoFocus
              />
            </div>
            <button
              onClick={handleGuestSubmit}
              disabled={!guestName.trim()}
              className="w-full bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded hover:bg-gray-500 mb-4 transition-colors"
            >
              Enter Cipher
            </button>
            <button
              onClick={() => setView("main")}
              className="text-[#b5bac1] text-sm hover:text-white hover:underline w-full text-center"
            >
              Back to options
            </button>
          </div>
        )}
      </div>
    </div>
  );
}