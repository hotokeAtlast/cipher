import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AppShell from './components/AppShell';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ToastProvider } from './context/ToastContext';
import UsernameSetup from './components/UsernameSetup';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // The crucial loading state

  useEffect(() => {
    // This listener fires automatically when the app loads or auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      
      if (firebaseUser) {
        // 1. VERIFIED USER FOUND: Fetch their custom rank/role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              name: data.name,
              email: data.email,
              role: data.role,
              rank: data.rank,
            });
          }
        } catch (error) {
          console.error("Error fetching user data on load:", error);
        }
      } else {
        // 2. NO FIREBASE USER: Check if they are a returning Guest
        const guestId = localStorage.getItem('cipher_guest_claim_token');
        if (guestId) {
          try {
            const guestDoc = await getDoc(doc(db, 'users', guestId));
            if (guestDoc.exists()) {
              const data = guestDoc.data();
              setUser({
                uid: guestId,
                name: data.name,
                role: data.role,
                rank: data.rank,
              });
            }
          } catch (error) {
             console.error("Error fetching guest data:", error);
          }
        }
      }
      
      // Stop the loading spinner once the check is complete
      setLoading(false);
    });

    // Cleanup the listener
    return () => unsubscribe();
  }, []);

  // THE LOGOUT CONTROLLER
  const handleLogout = async () => {
    await auth.signOut(); // Kills Firebase session
    localStorage.removeItem('cipher_guest_claim_token'); // Kills Guest session
    setUser(null); // Kills React state
  };

  // Show a dark, sleek loading screen while checking memory
  if (loading) {
    return (
      <div className="h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1d4ed8] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If no user was found in memory, show the front door
if (!user) {
    return (
      <ToastProvider>
        <Login onLogin={setUser} />
      </ToastProvider>
    );
  }

  // THE TRAP: If they are a verified user but don't have a username yet
  if (user.role !== 'guest' && !user.username) {
    return (
      <ToastProvider>
        <UsernameSetup user={user} onComplete={setUser} />
      </ToastProvider>
    );
  }

  // If they have a user object AND a username (or are a guest), let them in!
  return (
    <ToastProvider>
      <AppShell user={user} onLogout={handleLogout} />
    </ToastProvider>
  );
  
}

export default App;



