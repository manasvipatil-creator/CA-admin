// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/AdminPanel.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./components/pages/Login";
import Dashboard from "./components/pages/Dashboard";
import ClientManagement from "./components/pages/ClientManagement";
import ClientForm from "./components/pages/ClientForm";
import DocumentManagement from "./components/pages/DocumentManagement";
import GenericDocumentManagement from "./components/pages/GenericDocumentManagement";
import YearManagement from "./components/pages/YearManagement";
import BannerManagement from "./components/pages/BannerManagement";
import NotificationManagement from "./components/pages/NotificationManagement";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

function AppContent() {
  const { authenticated, loading } = useAuth();

  const handleLoginSuccess = () => {
    // Authentication state is now managed by AuthContext
    // Always redirect to dashboard after login
    window.location.href = '/admin/dashboard';
  };

  const handleLogout = async () => {
    try {
      // Sign out from Firebase Authentication
      await signOut(auth);
      console.log("🔐 Firebase sign out successful");
    } catch (error) {
      console.error("❌ Firebase sign out error:", error);
    }
    
    // Clear localStorage and context
    localStorage.removeItem("auth");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    
    // Clear any stored navigation state and redirect to login
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  return (
    <Router>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/clients" element={<ClientManagement />} />
          <Route path="/admin/clients/new" element={<ClientForm />} />
          <Route path="/admin/clients/edit" element={<ClientForm />} />
          <Route path="/admin/documents" element={<DocumentManagement />} />
          <Route path="/admin/generic-documents" element={<GenericDocumentManagement />} />
          <Route path="/admin/years" element={<YearManagement />} />
          <Route path="/admin/banners" element={<BannerManagement />} />
          <Route path="/admin/notifications" element={<NotificationManagement />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
