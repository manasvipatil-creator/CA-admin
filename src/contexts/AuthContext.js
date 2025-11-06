// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Constants for supernode structure
  const SUPERNODE_ROOT = 'ca_admin';

  // Generate user-specific Firestore document ID based on email
  const getSafeEmail = (email = userEmail) => {
    if (!email) return null;
    // Convert email to a Firestore-safe document ID (replace . with _)
    return email.replace(/\./g, '_');
  };

  // Get user document reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getUserDocRef = (email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail) return null;
    // New path: ca_admin/{safeEmail} (2 segments - even, this is a document) ✅
    return doc(db, SUPERNODE_ROOT, safeEmail);
  };

  // Get user profile document reference
  const getUserProfileRef = (email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail) return null;
    // Path: ca_admin/{safeEmail}/profile (3 segments - odd, this is a document) ✅
    return doc(db, SUPERNODE_ROOT, safeEmail, 'profile');
  };

  // Get user's clients collection reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getUserClientsRef = (email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail) return null;
    // New path: ca_admin/{safeEmail}/clients (3 segments - odd) ✅
    return collection(db, SUPERNODE_ROOT, safeEmail, 'clients');
  };

  // Get user's banners collection reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getUserBannersRef = (email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail) return null;
    // New path: ca_admin/{safeEmail}/banners (3 segments - odd) ✅
    return collection(db, SUPERNODE_ROOT, safeEmail, 'banners');
  };

  // Get user's admin collection reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getUserAdminRef = (email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail) return null;
    // New path: ca_admin/{safeEmail}/admin (3 segments - odd) ✅
    return collection(db, SUPERNODE_ROOT, safeEmail, 'admin');
  };

  // Get user's notifications collection reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getUserNotificationsRef = (email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail) return null;
    // New path: ca_admin/{safeEmail}/notifications (3 segments - odd) ✅
    return collection(db, SUPERNODE_ROOT, safeEmail, 'notifications');
  };

  // Get specific notification document reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getNotificationDocRef = (notificationId, email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail || !notificationId) return null;
    // New path: ca_admin/{safeEmail}/notifications/{notificationId} (4 segments - even) ✅
    return doc(db, SUPERNODE_ROOT, safeEmail, 'notifications', notificationId);
  };

  // Get specific client document reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getClientDocRef = (clientContact, email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail || !clientContact) return null;
    // New path: ca_admin/{safeEmail}/clients/{clientContact} (4 segments - even) ✅
    return doc(db, SUPERNODE_ROOT, safeEmail, 'clients', clientContact);
  };

  // Get client's years collection reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getClientYearsRef = (clientContact, email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail || !clientContact) return null;
    // New path: ca_admin/{safeEmail}/clients/{clientContact}/years (5 segments - odd) ✅
    return collection(db, SUPERNODE_ROOT, safeEmail, 'clients', clientContact, 'years');
  };

  // Get specific year document reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getYearDocRef = (clientContact, year, email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail || !clientContact || !year) return null;
    // New path: ca_admin/{safeEmail}/clients/{clientContact}/years/{year} (6 segments - even) ✅
    return doc(db, SUPERNODE_ROOT, safeEmail, 'clients', clientContact, 'years', year.toString());
  };

  // Get specific year documents collection reference (NEW SUPERNODE STRUCTURE - NO DUMMY NODES)
  const getYearDocumentsRef = (clientContact, year, email = userEmail) => {
    const safeEmail = getSafeEmail(email);
    if (!safeEmail || !clientContact || !year) return null;
    // New path: ca_admin/{safeEmail}/clients/{clientContact}/years/{year}/documents (7 segments - odd) ✅
    return collection(db, SUPERNODE_ROOT, safeEmail, 'clients', clientContact, 'years', year.toString(), 'documents');
  };

  // Legacy paths for backward compatibility (if needed during migration)
  const getUserPath = (email = userEmail) => {
    if (!email) return null;
    const safeEmail = email.replace(/\./g, '_');
    return `CA Firm/${safeEmail}`;
  };

  const getUserClientPath = (email = userEmail) => {
    if (!email) return null;
    const safeEmail = email.replace(/\./g, '_');
    return `CA Firm/${safeEmail}/users`;
  };

  const getUserAdminPath = (email = userEmail) => {
    if (!email) return null;
    const safeEmail = email.replace(/\./g, '_');
    return `CA Firm/${safeEmail}/admin`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("🔐 User is signed in:", user.email);
        setCurrentUser(user);
        setUserEmail(user.email);
        setUserId(user.uid);
        setAuthenticated(true);
        
        // Store in localStorage
        localStorage.setItem("auth", "true");
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("userId", user.uid);
      } else {
        console.log("🔐 User is signed out");
        
        // Check localStorage for fallback authentication
        const storedAuth = localStorage.getItem("auth");
        const storedEmail = localStorage.getItem("userEmail");
        const storedUserId = localStorage.getItem("userId");
        
        if (storedAuth === "true" && storedEmail) {
          setUserEmail(storedEmail);
          setUserId(storedUserId);
          setAuthenticated(true);
        } else {
          setCurrentUser(null);
          setUserEmail(null);
          setUserId(null);
          setAuthenticated(false);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = () => {
    setCurrentUser(null);
    setUserEmail(null);
    setUserId(null);
    setAuthenticated(false);
    localStorage.removeItem("auth");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
  };

  const value = {
    currentUser,
    userEmail,
    userId,
    authenticated,
    loading,
    // Supernode constants
    SUPERNODE_ROOT,
    // Firestore references (NEW SUPERNODE STRUCTURE)
    getSafeEmail,
    getUserDocRef,
    getUserProfileRef,
    getUserClientsRef,
    getUserBannersRef,
    getUserAdminRef,
    getUserNotificationsRef,
    getNotificationDocRef,
    getClientDocRef,
    getClientYearsRef,
    getYearDocRef,
    getYearDocumentsRef,
    // Legacy paths (for migration)
    getUserPath,
    getUserClientPath,
    getUserAdminPath,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
