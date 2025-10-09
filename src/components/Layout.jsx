// src/components/Layout.js
import React from "react";
import { Container, Row, Col, Nav, Navbar } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Layout = ({ onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userEmail } = useAuth();

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Function to capitalize first letter of the username
  const getCapitalizedUsername = (email) => {
    if (!email) return 'Admin';
    const username = email.split('@')[0];
    return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh'
    }}>
      <Container fluid>
        <Row>
          {/* Sidebar */}
          <Col md={2} style={{
            background: 'linear-gradient(180deg, #2c3e50 0%, #34495e 100%)',
            minHeight: '100vh',
            padding: '0',
            boxShadow: '4px 0 20px rgba(0,0,0,0.1)'
          }}>
            <div className="p-4">
              <div className="text-center mb-4">
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'linear-gradient(45deg, #667eea, #764ba2)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: '24px',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                }}>
                  🏢
                </div>
                <h4 style={{
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '1.3rem',
                  marginBottom: '4px',
                  letterSpacing: '0.5px'
                }}>CA Admin</h4>
                <p style={{
                  color: '#bdc3c7',
                  fontSize: '0.85rem',
                  margin: '0'
                }}>Management Panel</p>
                {userEmail && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#ecf0f1',
                    textAlign: 'center',
                    wordBreak: 'break-word'
                  }}>
                    👤 {userEmail}
                  </div>
                )}
              </div>
              
              <Nav className="flex-column">
                <Nav.Link 
                  onClick={() => navigate("/admin/dashboard")} 
                  style={{
                    color: 'white',
                    cursor: 'pointer',
                    padding: '12px 20px',
                    margin: '4px 0',
                    borderRadius: '12px',
                    background: isActive("/admin/dashboard") 
                      ? 'linear-gradient(45deg, #667eea, #764ba2)' 
                      : 'transparent',
                    border: 'none',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    boxShadow: isActive("/admin/dashboard") 
                      ? '0 4px 15px rgba(102, 126, 234, 0.3)' 
                      : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive("/admin/dashboard")) {
                      e.target.style.background = 'rgba(255,255,255,0.1)';
                      e.target.style.transform = 'translateX(5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive("/admin/dashboard")) {
                      e.target.style.background = 'transparent';
                      e.target.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  📊 Dashboard
                </Nav.Link>
                <Nav.Link 
                  onClick={() => navigate("/admin/clients")} 
                  style={{
                    color: 'white',
                    cursor: 'pointer',
                    padding: '12px 20px',
                    margin: '4px 0',
                    borderRadius: '12px',
                    background: isActive("/admin/clients") 
                      ? 'linear-gradient(45deg, #667eea, #764ba2)' 
                      : 'transparent',
                    border: 'none',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    boxShadow: isActive("/admin/clients") 
                      ? '0 4px 15px rgba(102, 126, 234, 0.3)' 
                      : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive("/admin/clients")) {
                      e.target.style.background = 'rgba(255,255,255,0.1)';
                      e.target.style.transform = 'translateX(5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive("/admin/clients")) {
                      e.target.style.background = 'transparent';
                      e.target.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  👥 Client Management
                </Nav.Link>
                <Nav.Link 
                  onClick={() => navigate("/admin/banners")} 
                  style={{
                    color: 'white',
                    cursor: 'pointer',
                    padding: '12px 20px',
                    margin: '4px 0',
                    borderRadius: '12px',
                    background: isActive("/admin/banners") 
                      ? 'linear-gradient(45deg, #667eea, #764ba2)' 
                      : 'transparent',
                    border: 'none',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    boxShadow: isActive("/admin/banners") 
                      ? '0 4px 15px rgba(102, 126, 234, 0.3)' 
                      : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive("/admin/banners")) {
                      e.target.style.background = 'rgba(255,255,255,0.1)';
                      e.target.style.transform = 'translateX(5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive("/admin/banners")) {
                      e.target.style.background = 'transparent';
                      e.target.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  🎨 Banner Management
                </Nav.Link>
                <Nav.Link 
                  onClick={() => navigate("/admin/notifications")} 
                  style={{
                    color: 'white',
                    cursor: 'pointer',
                    padding: '12px 20px',
                    margin: '4px 0',
                    borderRadius: '12px',
                    background: isActive("/admin/notifications") 
                      ? 'linear-gradient(45deg, #667eea, #764ba2)' 
                      : 'transparent',
                    border: 'none',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    transition: 'all 0.3s ease',
                    boxShadow: isActive("/admin/notifications") 
                      ? '0 4px 15px rgba(102, 126, 234, 0.3)' 
                      : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive("/admin/notifications")) {
                      e.target.style.background = 'rgba(255,255,255,0.1)';
                      e.target.style.transform = 'translateX(5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive("/admin/notifications")) {
                      e.target.style.background = 'transparent';
                      e.target.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  🔔 Notifications
                </Nav.Link>
              </Nav>
            </div>
          </Col>

          {/* Main Content */}
          <Col md={10} style={{ padding: '0' }}>
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
              margin: '20px',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              minHeight: 'calc(100vh - 40px)'
            }}>
              {/* Top Header */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                borderRadius: '20px 20px 0 0',
                padding: '20px 30px',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                backdropFilter: 'blur(10px)'
              }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h2 style={{
                      margin: '0',
                      background: 'linear-gradient(45deg, #667eea, #764ba2)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontWeight: '700',
                      fontSize: '1.8rem'
                    }}>Welcome, {getCapitalizedUsername(userEmail)}</h2>
                    <p style={{
                      margin: '4px 0 0 0',
                      color: '#6c757d',
                      fontSize: '0.9rem'
                    }}>Your personal CA Firm dashboard</p>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{
                      background: 'linear-gradient(45deg, #667eea, #764ba2)',
                      borderRadius: '50%',
                      width: '45px',
                      height: '45px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
                    }}>
                      {userEmail ? userEmail.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <button
                      style={{
                        background: 'linear-gradient(45deg, #ff6b6b, #ee5a52)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '10px 20px',
                        color: 'white',
                        fontWeight: '500',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(255, 107, 107, 0.2)'
                      }}
                      onClick={() => {
                        if (typeof onLogout === "function") onLogout();
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 20px rgba(255, 107, 107, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 8px rgba(255, 107, 107, 0.2)';
                      }}
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Content Area */}
              <div style={{ padding: '30px' }}>
                {children}
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Layout;
