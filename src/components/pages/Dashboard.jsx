// src/components/pages/Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { Card, Row, Col, Table, ProgressBar, Spinner } from "react-bootstrap";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { clientHelpers, documentHelpers, firestoreHelpers } from "../../utils/firestoreHelpers";
import { 
  FiUsers, 
  FiFileText, 
  FiCalendar, 
  FiUser, 
  FiMail, 
  FiPhone,
  FiBarChart2,
  FiRefreshCw
} from "react-icons/fi";

const Dashboard = ({ goToClient, goToReports }) => {
  const { userEmail, getUserClientsRef, getClientYearsRef, getYearDocumentsRef } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [allDocuments, setAllDocuments] = useState([]);

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

    console.log("🔗 Setting up Firestore listener for clients in Dashboard");
    const unsubscribe = clientHelpers.subscribeToClients(
      clientsRef,
      (clientsList) => {
        console.log("📊 Dashboard: Received", clientsList.length, "clients from Firestore");
        
        // Debug: Log client data structure
        clientsList.forEach((client, index) => {
          console.log(`📋 Client ${index + 1} (${client.name}):`, client);
          if (client.documents) {
            console.log(`📄 Documents in ${client.name}:`, Object.keys(client.documents).length);
          }
          // Check for year-based structure
          const yearKeys = Object.keys(client).filter(key => /^\d{4}$/.test(key));
          if (yearKeys.length > 0) {
            console.log(`📅 Year keys in ${client.name}:`, yearKeys);
          }
        });
        
        setClients(clientsList);
        setLoading(false);
        setLastUpdated(new Date());
      },
      (error) => {
        console.error("❌ Dashboard: Firestore clients listener error:", error);
        setClients([]);
        setLoading(false);
      }
    );

    return () => {
      console.log("🧹 Dashboard: Cleaning up clients listener");
      if (unsubscribe) unsubscribe();
    };
  }, [userEmail, getUserClientsRef]);

  // Fetch all documents for all clients and years
  const fetchAllDocuments = async (clientsList) => {
    if (!clientsList || clientsList.length === 0) {
      setAllDocuments([]);
      return;
    }

    try {
      const allDocs = [];
      
      for (const client of clientsList) {
        const clientPAN = client.id; // PAN is used as document ID
        
        // Get years collection for this client
        const yearsRef = getClientYearsRef(clientPAN);
        if (!yearsRef) continue;
        
        try {
          // Get all years for this client
          const yearsSnapshot = await firestoreHelpers.getCollection(yearsRef);
          
          for (const yearDoc of yearsSnapshot) {
            const year = yearDoc.id;
            
            // Get documents for this year
            const documentsRef = getYearDocumentsRef(clientPAN, year);
            if (!documentsRef) continue;
            
            try {
              const documents = await documentHelpers.getDocuments(documentsRef);
              
              // Add client info to each document
              documents.forEach(doc => {
                allDocs.push({
                  ...doc,
                  clientId: client.id,
                  clientName: client.name,
                  clientPAN: clientPAN,
                  year: year
                });
              });
            } catch (docError) {
              console.log(`📄 No documents found for ${client.name} - ${year}`);
            }
          }
        } catch (yearError) {
          console.log(`📅 No years found for client ${client.name}`);
        }
      }
      
      console.log("📊 Total documents fetched:", allDocs.length);
      setAllDocuments(allDocs);
    } catch (error) {
      console.error("❌ Error fetching all documents:", error);
      setAllDocuments([]);
    }
  };

  // Fetch documents whenever clients change
  useEffect(() => {
    if (clients.length > 0) {
      fetchAllDocuments(clients);
    }
  }, [clients, getClientYearsRef, getYearDocumentsRef]);

  // Compute document-based stats using fetched documents
  const docStats = useMemo(() => {
    const byYear = {};
    let total = 0;
    const currentYear = new Date().getFullYear();
    
    // Use the fetched documents from Firestore
    allDocuments.forEach((doc) => {
      // Skip placeholder documents
      if (doc.fileName === "placeholder.txt" || 
          (doc.docName && doc.docName.includes("Initial Setup")) ||
          (doc.name && doc.name.includes("Initial Setup"))) {
        return;
      }
      
      const year = String(doc?.year || "Unknown");
      byYear[year] = (byYear[year] || 0) + 1;
      total += 1;
    });
    
    const thisYear = byYear[String(currentYear)] || 0;
    const lastYear = byYear[String(currentYear - 1)] || 0;
    return { total, thisYear, lastYear, byYear, currentYear };
  }, [allDocuments]);

  // Recent clients (latest 5 by creation/update time)
  const recentClients = useMemo(() => {
    const clientsWithTime = clients.map(client => ({
      ...client,
      // Use updatedAt or createdAt timestamp, fallback to current time
      lastActivity: client.updatedAt?.seconds || client.createdAt?.seconds || Date.now() / 1000
    }));
    
    // Sort by last activity (most recent first)
    clientsWithTime.sort((a, b) => b.lastActivity - a.lastActivity);
    
    return clientsWithTime.slice(0, 5);
  }, [clients]);
  const yearOptions = useMemo(() => {
    const ys = Object.keys(docStats.byYear || {}).filter((y) => y && y !== "Unknown");
    ys.sort((a, b) => Number(b) - Number(a));
    return ys;
  }, [docStats]);

  const selectedYearCount = useMemo(() => {
    if (!selectedYear) return docStats.total;
  }, [docStats, selectedYear]);

  return (
    <div className="container-fluid">
      {/* Hero Header */}
      <div className="mb-4 p-4 rounded-4 shadow-lg" style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "#fff",
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <div>
          <h1 className="mb-2" style={{
            fontWeight: '700',
            fontSize: '2.2rem',
            textShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>Welcome, {userEmail}</h1>
          <p className="mb-0" style={{
            fontSize: '1.1rem',
            opacity: '0.9'
          }}>Your Personal CA firm dashboard</p>
          {lastUpdated && (
            <p className="mb-0 mt-2" style={{
              fontSize: '0.9rem',
              opacity: '0.7'
            }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <Row className="g-4 mb-5 justify-content-center">
        <Col md={4}>
          <Card style={{
            border: 'none',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            height: '160px',
            minWidth: '280px'
          }}
          onClick={() => {
            if (typeof goToClient === 'function') {
              goToClient();
            }
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3)';
          }}>
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div style={{ opacity: '0.8', fontSize: '0.9rem', fontWeight: '500' }}>Total Clients</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: '700', marginTop: '8px' }}>
                    {loading ? <Spinner size="sm" /> : clients.length}
                  </div>
                </div>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  <FiUsers size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card style={{
            border: 'none',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            color: '#8b4513',
            boxShadow: '0 8px 32px rgba(252, 182, 159, 0.3)',
            transition: 'all 0.3s ease',
            height: '160px',
            minWidth: '280px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(252, 182, 159, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(252, 182, 159, 0.3)';
          }}>
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div style={{ opacity: '0.8', fontSize: '0.9rem', fontWeight: '500' }}>Total Documents</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: '700', marginTop: '8px' }}>
                    {loading ? <Spinner size="sm" /> : docStats.total}
                  </div>
                </div>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'rgba(139, 69, 19, 0.2)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  <FiFileText size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>


      <Row className="g-4">
        {/* Year-wise snapshot */}
        <Col md={7}>
          <Card style={{
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)'
          }}>
            <Card.Header style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '16px 16px 0 0',
              padding: '20px 24px',
              border: 'none'
            }}>
              <h5 className="mb-0 fw-bold d-flex align-items-center">
                <FiBarChart2 className="me-2" size={20} />
                Year-wise Snapshot
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover className="mb-0" style={{ borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
                  <thead style={{
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                  }}>
                    <tr>
                      <th style={{
                        padding: '16px 24px',
                        fontWeight: '600',
                        color: '#2c3e50',
                        border: 'none'
                      }}>
                        <FiCalendar className="me-2" size={16} />
                        Year
                      </th>
                      <th style={{
                        padding: '16px 24px',
                        fontWeight: '600',
                        color: '#2c3e50',
                        textAlign: 'end',
                        border: 'none'
                      }}>
                        <FiFileText className="me-2" size={16} />
                        Records
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(docStats.byYear)
                      .sort((a,b)=> Number(b[0]) - Number(a[0]))
                      .slice(0, 5)
                      .map(([y, count], index) => (
                        <tr key={y} style={{ 
                          cursor: 'pointer',
                          backgroundColor: index % 2 === 0 ? '#f8f9ff' : 'white',
                          transition: 'all 0.3s ease'
                        }} 
                        onClick={() => {
                          try { localStorage.setItem('reportExportYear', y); } catch {}
                          if (typeof goToReports === 'function') goToReports();
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e3f2fd';
                          e.currentTarget.style.transform = 'translateX(5px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#f8f9ff' : 'white';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}>
                          <td style={{
                            padding: '16px 24px',
                            fontWeight: '500',
                            color: '#2c3e50',
                            border: 'none',
                            borderBottom: '1px solid #e9ecef'
                          }}>
                            <span className="badge bg-primary px-3 py-2" style={{
                              fontSize: '0.9rem',
                              borderRadius: '12px'
                            }}>{y}</span>
                          </td>
                          <td style={{
                            padding: '16px 24px',
                            textAlign: 'end',
                            fontWeight: '600',
                            color: '#667eea',
                            fontSize: '1.1rem',
                            border: 'none',
                            borderBottom: '1px solid #e9ecef'
                          }}>{count}</td>
                        </tr>
                    ))}
                    {Object.keys(docStats.byYear).length === 0 && (
                      <tr>
                        <td colSpan={2} style={{
                          padding: '40px 24px',
                          textAlign: 'center',
                          color: '#6c757d',
                          fontSize: '1.1rem',
                          border: 'none'
                        }}>
                          <div>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
                              <FiBarChart2 size={48} color="#6c757d" />
                            </div>
                            <div>No data available</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Recent clients */}
        <Col md={5}>
          <Card style={{
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)',
            height: '100%'
          }}>
            <Card.Header style={{
              background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              color: '#8b4513',
              borderRadius: '16px 16px 0 0',
              padding: '20px 24px',
              border: 'none'
            }}>
              <h5 className="mb-0 fw-bold d-flex align-items-center">
                <FiUsers className="me-2" size={20} />
                Recent Clients
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              {recentClients.length === 0 ? (
                <div style={{
                  padding: '40px 24px',
                  textAlign: 'center',
                  color: '#6c757d',
                  fontSize: '1.1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
                      <FiUsers size={48} color="#6c757d" />
                    </div>
                    <div style={{ fontWeight: '500', marginBottom: '8px' }}>No recent clients</div>
                    <div style={{ fontSize: '0.9rem', color: '#adb5bd' }}>Add your first client to get started</div>
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table className="mb-0" style={{ borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
                    <thead style={{
                      background: 'linear-gradient(135deg, rgba(255, 236, 210, 0.3) 0%, rgba(252, 182, 159, 0.3) 100%)'
                    }}>
                      <tr>
                        <th style={{
                          padding: '16px 24px',
                          fontWeight: '600',
                          color: '#2c3e50',
                          border: 'none'
                        }}>
                          <FiUser className="me-2" size={16} />
                          Name
                        </th>
                        <th style={{
                          padding: '16px 24px',
                          fontWeight: '600',
                          color: '#2c3e50',
                          border: 'none'
                        }}>
                          <FiMail className="me-2" size={16} />
                          Contact
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentClients.map((client, i) => (
                        <tr key={client.id || i} 
                        style={{
                          backgroundColor: i % 2 === 0 ? '#fff8f0' : 'white',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          if (typeof goToClient === 'function') {
                            goToClient(client.id);
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffecd2';
                          e.currentTarget.style.transform = 'translateX(5px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#fff8f0' : 'white';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}>
                          <td style={{
                            padding: '16px 24px',
                            fontWeight: '500',
                            color: '#2c3e50',
                            border: 'none',
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                            <div className="d-flex align-items-center">
                              <div style={{
                                width: '32px',
                                height: '32px',
                                background: 'linear-gradient(45deg, #ffecd2, #fcb69f)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: '12px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: '#8b4513'
                              }}>
                                {client.name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <div style={{ fontWeight: '600' }}>{client.name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                  PAN: {client.pan || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{
                            padding: '16px 24px',
                            border: 'none',
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                            <div style={{ fontSize: '0.9rem' }}>
                              <div>{client.email || 'No email'}</div>
                              <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                {client.contact || 'No contact'}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

    </div>
  );
};

export default Dashboard;
