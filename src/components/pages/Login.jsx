// src/components/pages/Login.js
import React, { useState } from "react";
import { Card, Form, Button, Alert } from "react-bootstrap";
import { auth, rtdb } from "../../firebase";
import { ref, get } from "firebase/database";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const Login = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const verifyAdmin = (data, emailIn, passwordIn) => {
    if (!data) return false;
    const normalize = (s) => String(s || "").trim().toLowerCase();

    // Support either a single admin object { email, password }
    // or a map of admins { adminId: { email, password }, ... }
    if (data.email && data.password) {
      return (
        normalize(data.email) === normalize(emailIn) && String(data.password) === String(passwordIn)
      );
    }
    if (typeof data === "object") {
      return Object.values(data).some(
        (u) => normalize(u?.email) === normalize(emailIn) && String(u?.password) === String(passwordIn)
      );
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Try Firebase Authentication first
      console.log("🔐 Attempting Firebase Authentication login...");
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log("✅ Firebase Authentication successful:", user.email);
      
      // Store user info in localStorage
      localStorage.setItem("auth", "true");
      localStorage.setItem("userEmail", user.email);
      localStorage.setItem("userId", user.uid);
      
      // Always redirect to dashboard after successful login
      console.log("🎯 Redirecting to dashboard after successful login");
      if (typeof onSuccess === "function") onSuccess();
      
    } catch (authError) {
      console.log("❌ Firebase Authentication failed:", authError.message);
      
      // Fallback to database verification (backward compatibility)
      try {
        console.log("🔄 Trying database verification as fallback...");
        const snap = await get(ref(rtdb, "admin"));
        const ok = verifyAdmin(snap.val(), email, password);
        if (ok) {
          console.log("✅ Database verification successful");
          localStorage.setItem("auth", "true");
          localStorage.setItem("userEmail", email);
          console.log("🎯 Redirecting to dashboard after successful database login");
          if (typeof onSuccess === "function") onSuccess();
        } else {
          setError("Invalid email or password.");
        }
      } catch (dbError) {
        console.error("❌ Database verification also failed:", dbError.message);
        setError("Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh", background: "#f8f9fa" }}>
      <Card className="shadow-sm" style={{ width: 420 }}>
        <Card.Body>
          <h4 className="mb-3 text-center">Admin Login</h4>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="loginEmail">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="loginPassword">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>
            {error && (
              <Alert variant="danger" className="py-2">
                {error}
              </Alert>
            )}
            <div className="d-grid">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? "Signing in..." : "Login"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Login;
