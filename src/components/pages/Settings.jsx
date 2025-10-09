// src/components/pages/Settings.js
import React, { useState, useEffect } from "react";
import { Card, Form, Button, Alert, Row, Col, Badge, Modal, Table } from "react-bootstrap";
import { rtdb } from "../../firebase";
import { ref, set } from "firebase/database";
import { useAuth } from "../../contexts/AuthContext";
import { clientHelpers } from "../../utils/firestoreHelpers";

const Settings = () => {
  const { userEmail, getUserClientsRef } = useAuth();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [clients, setClients] = useState([]);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    theme: 'light',
    notifications: true,
    autoBackup: false,
    pageSize: 10,
    companyName: 'CA Admin Panel',
    adminEmail: 'admin@example.com'
  });

  // Load clients for statistics from Firestore
  useEffect(() => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    const clientsRef = getUserClientsRef();
    if (!clientsRef) {
      setLoading(false);
      return;
    }

    console.log("🔗 Setting up Firestore listener for clients in Settings");
    const unsubscribe = clientHelpers.subscribeToClients(
      clientsRef,
      (clientsList) => {
        console.log("📊 Settings: Received", clientsList.length, "clients from Firestore");
        setClients(clientsList);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Settings: Firestore clients listener error:", error);
        setClients([]);
        setLoading(false);
      }
    );

    return () => {
      console.log("🧹 Settings: Cleaning up clients listener");
      if (unsubscribe) unsubscribe();
    };
  }, [userEmail, getUserClientsRef]);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('caAdminSettings');
      if (savedSettings) {
        setSettings({ ...settings, ...JSON.parse(savedSettings) });
      }
    } catch (error) {
      console.log('No saved settings found');
    }
  }, []);

  const handleTestFirebase = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const testRef = ref(rtdb, 'diagnostics/test');
      await set(testRef, {
        timestamp: Date.now(),
        status: 'Connection test successful',
        env: 'web'
      });
      setTestResult({ ok: true, message: 'Firebase Realtime Database connection successful!' });
    } catch (err) {
      setTestResult({ ok: false, message: `Connection failed: ${err?.message || err}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('caAdminSettings', JSON.stringify(newSettings));
  };

  const handleBackupData = () => {
    const backupData = {
      clients: clients,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ca-admin-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowBackupModal(false);
  };

  // Calculate statistics based on Firestore structure
  const totalClients = clients.length;
  const totalYears = clients.reduce((total, client) => {
    const years = client?.years || [];
    return total + years.length;
  }, 0);

  // Note: Document count would require querying each year's documents collection
  // For performance, we'll show placeholder values or implement async loading
  const currentYear = new Date().getFullYear();
  const clientsWithCurrentYear = clients.filter(client => 
    client?.years?.includes(currentYear.toString())
  ).length;
  return (
    <div>
      {/* Header */}
      <div className="mb-4 p-4 rounded-4 shadow-lg" style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "#fff"
      }}>
        <h1 className="mb-2" style={{
          fontWeight: '700',
          fontSize: '2.2rem',
          textShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}>⚙️ Settings & Configuration</h1>
        <p className="mb-0" style={{
          fontSize: '1.1rem',
          opacity: '0.9'
        }}>Manage your CA Admin panel preferences and system settings</p>
      </div>

      <Row className="g-4">
        {/* System Statistics */}
        <Col md={4}>
          <Card style={{
            border: 'none',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
          }}>
            <Card.Body className="p-4">
              <h5 className="mb-3 fw-bold">📊 System Statistics</h5>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span>Total Clients</span>
                <Badge bg="light" text="dark" className="px-3 py-2">{loading ? '...' : totalClients}</Badge>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span>Total Years</span>
                <Badge bg="light" text="dark" className="px-3 py-2">{loading ? '...' : totalYears}</Badge>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span>{currentYear} Clients</span>
                <Badge bg="light" text="dark" className="px-3 py-2">{loading ? '...' : clientsWithCurrentYear}</Badge>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Application Settings */}
        <Col md={8}>
          <Card style={{
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}>
            <Card.Header style={{
              background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              color: '#8b4513',
              borderRadius: '16px 16px 0 0',
              padding: '20px 24px',
              border: 'none'
            }}>
              <h5 className="mb-0 fw-bold">🎨 Application Settings</h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">🎨 Theme</Form.Label>
                      <Form.Select 
                        value={settings.theme}
                        onChange={(e) => handleSettingChange('theme', e.target.value)}
                        style={{ borderRadius: '8px' }}
                      >
                        <option value="light">Light Theme</option>
                        <option value="dark">Dark Theme</option>
                        <option value="auto">Auto (System)</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">📄 Page Size</Form.Label>
                      <Form.Select 
                        value={settings.pageSize}
                        onChange={(e) => handleSettingChange('pageSize', parseInt(e.target.value))}
                        style={{ borderRadius: '8px' }}
                      >
                        <option value={5}>5 per page</option>
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">🏢 Company Name</Form.Label>
                      <Form.Control 
                        type="text"
                        value={settings.companyName}
                        onChange={(e) => handleSettingChange('companyName', e.target.value)}
                        style={{ borderRadius: '8px' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">📧 Admin Email</Form.Label>
                      <Form.Control 
                        type="email"
                        value={settings.adminEmail}
                        onChange={(e) => handleSettingChange('adminEmail', e.target.value)}
                        style={{ borderRadius: '8px' }}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Check 
                      type="checkbox" 
                      label="🔔 Enable notifications"
                      checked={settings.notifications}
                      onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                      className="mb-3"
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Check 
                      type="checkbox" 
                      label="💾 Auto backup (weekly)"
                      checked={settings.autoBackup}
                      onChange={(e) => handleSettingChange('autoBackup', e.target.checked)}
                      className="mb-3"
                    />
                  </Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4 mt-2">
        {/* System Tools */}
        <Col md={6}>
          <Card style={{
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}>
            <Card.Header style={{
              background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              color: '#2c3e50',
              borderRadius: '16px 16px 0 0',
              padding: '20px 24px',
              border: 'none'
            }}>
              <h5 className="mb-0 fw-bold">🛠️ System Tools</h5>
            </Card.Header>
            <Card.Body className="p-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <div className="fw-semibold mb-1">💾 Data Backup</div>
                  <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                    Download a complete backup of all client data
                  </div>
                </div>
                <Button 
                  variant="success" 
                  onClick={() => setShowBackupModal(true)}
                  style={{
                    borderRadius: '8px',
                    padding: '8px 16px'
                  }}
                >
                  💾 Backup
                </Button>
              </div>
              <hr style={{ margin: '16px 0' }} />
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="fw-semibold mb-1">🔌 Database Connection</div>
                  <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                    Test Firebase Realtime Database connectivity
                  </div>
                </div>
                <Button 
                  variant="primary" 
                  onClick={handleTestFirebase} 
                  disabled={testing}
                  style={{
                    borderRadius: '8px',
                    padding: '8px 16px'
                  }}
                >
                  {testing ? "🔄 Testing..." : "🔌 Test"}
                </Button>
              </div>
              {testResult && (
                <Alert className="mt-3" variant={testResult.ok ? "success" : "danger"} style={{ borderRadius: '8px' }}>
                  {testResult.message}
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col md={6}>
          <Card style={{
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}>
            <Card.Header style={{
              background: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
              color: '#2c3e50',
              borderRadius: '16px 16px 0 0',
              padding: '20px 24px',
              border: 'none'
            }}>
              <h5 className="mb-0 fw-bold">⚡ Quick Actions</h5>
            </Card.Header>
            <Card.Body className="p-4">
              <div className="d-grid gap-3">
                <Button 
                  variant="outline-primary" 
                  onClick={() => window.location.reload()}
                  style={{ borderRadius: '8px', padding: '12px' }}
                >
                  🔄 Refresh Application
                </Button>
                <Button 
                  variant="outline-warning" 
                  onClick={() => localStorage.clear()}
                  style={{ borderRadius: '8px', padding: '12px' }}
                >
                  🧹 Clear Cache
                </Button>
                <Button 
                  variant="outline-info" 
                  onClick={() => window.open('https://firebase.google.com/docs', '_blank')}
                  style={{ borderRadius: '8px', padding: '12px' }}
                >
                  📚 Firebase Docs
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Backup Modal */}
      <Modal show={showBackupModal} onHide={() => setShowBackupModal(false)} centered>
        <Modal.Header closeButton style={{ borderRadius: '16px 16px 0 0' }}>
          <Modal.Title>💾 Data Backup</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>This will download a JSON file containing all your client data including:</p>
          <ul>
            <li>👥 All client information ({clients.length} clients)</li>
            <li>📄 All document metadata ({totalDocuments} documents)</li>
            <li>📅 Timestamp and version information</li>
          </ul>
          <Alert variant="info" style={{ borderRadius: '8px' }}>
            <strong>Note:</strong> This backup contains metadata only. Actual files are stored in Firebase Storage.
          </Alert>
        </Modal.Body>
        <Modal.Footer style={{ borderRadius: '0 0 16px 16px' }}>
          <Button variant="secondary" onClick={() => setShowBackupModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleBackupData}>
            💾 Download Backup
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Settings;
