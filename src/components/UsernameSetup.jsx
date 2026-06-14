import React, { useState, useEffect } from "react";
import { collection, doc, getDoc, getDocs, setDoc, where, writeBatch, query } from "firebase/firestore";
import { db } from "../firebase";

export default function UsernameSetup({ pendingUser, onComplete, onCancel }) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("idle"); // idle, checking, available, taken
  const [isSubmitting, setIsSubmitting] = useState(false);

  
// REAL-TIME AVAILABILITY CHECKER
  useEffect(() => {
    const formattedUsername = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    if (formattedUsername.length < 3) {
      setStatus("idle");
      return;
    }

    const checkUsername = async () => {
      setStatus("checking");
      
      const q = query(collection(db, 'users'), where('username', '==', formattedUsername));

      
      const querySnapshot = await getDocs(q);

      
      if (!querySnapshot.empty) {
        setStatus("taken");
      } else {
        setStatus("available");
      }
    };

    const delayDebounceFn = setTimeout(() => {
      checkUsername();
    }, 500);
    
    return () => clearTimeout(delayDebounceFn);
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "available" || isSubmitting) return;

    setIsSubmitting(true);
    const finalUsername = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    try {
      // We use a Batch Write to ensure both documents update at the exact same time
      const batch = writeBatch(db);

      // const q = query(db, 'users')
      const userRef = doc(db, "users", pendingUser.uid);

      await setDoc(userRef, {
        uid: pendingUser.uid,
        name: pendingUser.displayName || "Anonymous",
        username: username,
        email: pendingUser.email,
        role: "verified",
        rank: "Member",
        photoUrl: pendingUser.photoURL || null,
      });

      
      // const usernameRef = doc(db, "usernames", finalUsername);
      // batch.set(usernameRef, { uid: pendingUser.uid });

      // const userRef = doc(db, "users", pendingUser.uid);
      // batch.update(userRef, { username: finalUsername });

      
      // await batch.commit();

      // Tell App.jsx we are done and ready to enter the app!
      onComplete({ ...pendingUser, username: finalUsername });
    } catch (error) {
      console.error("Error claiming username or registering:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1e1f22] w-full max-w-md rounded-lg shadow-2xl overflow-hidden text-center p-8 border border-white/10">
        <h2 className="text-2xl font-extrabold text-white mb-2">
          Choose a username
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Choose a unique username to connect with friends.
        </p>

        <form onSubmit={handleSubmit} className="text-left">
          <label className="block text-[#b5bac1] text-xs font-bold mb-2 uppercase tracking-wide">
            Username
          </label>
          <div className="relative flex items-center bg-[#111214] rounded mb-2 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
            <span className="absolute left-3 text-gray-500 font-bold">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="shadow_ninja"
              className="w-full bg-transparent text-[#f2f3f5] p-3 pl-8 border-none focus:outline-none"
              maxLength="20"
              autoFocus
            />
          </div>

          {/* Status Indicator */}
          <div className="h-4 mb-6 text-xs font-medium pl-1">
            {status === "checking" && (
              <span className="text-gray-400">Checking availability...</span>
            )}
            {status === "available" && (
              <span className="text-[#23a559]">Available!</span>
            )}
            {status === "taken" && (
              <span className="text-red-400">This username is taken.</span>
            )}
            {username.length > 0 && username.length < 3 && (
              <span className="text-red-400">
                Must be at least 3 characters.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={status !== "available" || isSubmitting}
            className="w-full bg-[#5865f2] text-white font-bold py-3 px-4 rounded hover:bg-[#4752c4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Enter Cipher"}
          </button>
        </form>
      </div>
    </div>
  );
}
