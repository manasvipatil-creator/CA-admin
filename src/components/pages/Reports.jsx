// src/components/pages/Reports.js
import React, { useEffect, useMemo, useState } from "react";
import { Card, Table, Button, Modal, Row, Col, Badge, Form, InputGroup, Pagination } from "react-bootstrap";
import { db } from "../../firebase";
import { doc as firestoreDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { clientHelpers, documentHelpers, firestoreHelpers } from "../../utils/firestoreHelpers";

const Reports = ({ goToClient }) => {
  const { userEmail, getUserClientsRef, getClientDocRef, getYearDocumentsRef } = useAuth();
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState("");
  const [yearRows, setYearRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch clients from Firestore
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

    console.log("🔗 Setting up Firestore listener for clients in Reports");
    const unsubscribe = clientHelpers.subscribeToClients(
      clientsRef,
      (clientsList) => {
        console.log("📊 Reports: Received", clientsList.length, "clients from Firestore");
        setClients(clientsList);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Reports: Firestore clients listener error:", error);
        setClients([]);
        setLoading(false);
      }
    );

    return () => {
      console.log("🧹 Reports: Cleaning up clients listener");
      if (unsubscribe) unsubscribe();
    };
  }, [userEmail, getUserClientsRef]);

  // ✅ Auto open modal if redirected from ClientManagement
  useEffect(() => {
    try {
      const year = localStorage.getItem("reportExportYear");
      const shouldAutoOpen = localStorage.getItem("autoOpenReportsModal");
      
      if (year && shouldAutoOpen === "true") {
        setSelectedYear(year);
        setShowModal(true);
        localStorage.removeItem("autoOpenReportsModal");
      }
    } catch {}
  }, []);

  // ✅ Prepare client records for table display with Firestore structure
  const clientRecords = useMemo(() => {
    const records = [];
    clients.forEach((client) => {
      // In Firestore, years are stored in the client's years array
      const years = client?.years || [];
      
      if (years.length > 0) {
        records.push({
          clientId: client.id, // This is the PAN
          clientName: client.name,
          contact: client.contact,
          email: client.email,
          pan: client.pan || client.id,
          totalDocs: 0, // Will be calculated when documents are loaded
          years: years.sort((a, b) => parseInt(b) - parseInt(a)),
          documents: [] // Will be populated when needed
        });
      }
    });
    return records;
  }, [clients]);

  // Load client documents from Firestore
  const loadClientDocuments = async (record) => {
    try {
      console.log("📄 Loading documents for client:", record.clientName, "(PAN:", record.clientId, ")");
      
      const yearBreakdown = [];
      let totalDocs = 0;
      
      // Load documents for each year from Firestore
      for (const year of record.years) {
        const documentsRef = getYearDocumentsRef(record.clientId, year);
        if (documentsRef) {
          try {
            const docs = await documentHelpers.getDocuments(documentsRef);
            
            // Filter out placeholder documents
            const realDocs = docs.filter(doc => 
              doc.fileName !== "placeholder.txt" && 
              (doc.docName || doc.name) && 
              !(doc.docName || doc.name).includes("Initial Setup")
            );
            
            if (realDocs.length > 0) {
              yearBreakdown.push({
                year,
                count: realDocs.length,
                documents: realDocs
              });
              totalDocs += realDocs.length;
            }
          } catch (error) {
            console.error(`❌ Error loading documents for year ${year}:`, error);
          }
        }
      }
      
      // Update the record with actual document count
      record.totalDocs = totalDocs;
      
      setYearRows(yearBreakdown);
      setSelectedYear(record.clientName);
      setShowModal(true);
      
      console.log(`📊 Loaded ${totalDocs} documents across ${yearBreakdown.length} years`);
    } catch (error) {
      console.error("❌ Error loading client documents:", error);
      alert(`❌ Failed to load documents: ${error.message}`);
    }
  };

  // Open client documents modal
  const openClientDocuments = async (record) => {
    await loadClientDocuments(record);
  };

  // Delete client function using Firestore
  const handleDeleteClient = async (clientId, clientName) => {
    const confirmMessage = `⚠️ Are you sure you want to delete client "${clientName}" and all their documents?\n\nThis action cannot be undone.`;
    if (window.confirm(confirmMessage)) {
      try {
        console.log("🗑️ Deleting client:", clientName, "(PAN:", clientId, ")");
        
        // Delete from Firestore using client PAN as document ID
        const clientDocRef = getClientDocRef(clientId); // clientId is the PAN
        if (!clientDocRef) {
          throw new Error("Unable to get client reference");
        }
        
        await clientHelpers.deleteClient(clientDocRef);
        console.log("✅ Client deleted successfully from Firestore");
        alert("✅ Client deleted successfully!");
      } catch (error) {
        console.error("❌ Failed to delete client:", error);
        alert(`❌ Failed to delete client: ${error.message}`);
      }
    }
  };
  
  // Delete document function using Firestore
  const handleDeleteDocument = async (clientId, docId, docYear, docName) => {
    const confirmMessage = `⚠️ Are you sure you want to delete "${docName}"?\n\nThis action cannot be undone.`;
    if (window.confirm(confirmMessage)) {
      try {
        console.log("🗑️ Deleting document:", docId, "from client:", clientId, "year:", docYear);
        
        // Delete from Firestore using proper structure
        const documentsRef = getYearDocumentsRef(clientId, docYear); // clientId is the PAN
        if (!documentsRef) {
          throw new Error("Unable to get documents collection reference");
        }
        
        const docRef = firestoreDoc(documentsRef, docId);
        await firestoreHelpers.delete(docRef);
        
        console.log("✅ Document deleted successfully from Firestore");
        alert("✅ Document deleted successfully!");
        
        // Close modal and refresh data
        setShowModal(false);
        
        // Refresh the client documents after deletion
        setTimeout(async () => {
          const updatedRecord = clientRecords.find(r => r.clientId === clientId);
          if (updatedRecord) {
            await loadClientDocuments(updatedRecord);
          }
        }, 500);
        
      } catch (error) {
        console.error("❌ Failed to delete document:", error);
        alert(`❌ Failed to delete document: ${error.message}`);
      }
    }
  };

  // Edit client function (redirect to client management)
  const handleEditClient = (clientId) => {
    console.log("✏️ Editing client:", clientId);
    // Store the client info for editing
    localStorage.setItem("editClientId", clientId);
    localStorage.setItem("navTo", "clients");
    
    if (typeof goToClient === "function") {
      console.log("🔄 Redirecting to Client Management...");
      goToClient();
    } else {
      console.log("⚠️ goToClient function not available");
      alert("⚠️ Navigation function not available. Please go to Client Management manually.");
    }
  };
  
  // Edit document function (redirect to client management)
  const handleEditDocument = (clientId, docId) => {
    console.log("✏️ Editing document:", docId, "for client:", clientId);
    
    if (!clientId || !docId) {
      console.error("❌ Missing clientId or docId:", { clientId, docId });
      alert("❌ Error: Missing client or document information.");
      return;
    }
    
    // Store the document info for editing
    localStorage.setItem("editDocumentId", docId);
    localStorage.setItem("editClientId", clientId);
    localStorage.setItem("navTo", "clients");
    
    console.log("💾 Stored in localStorage:", {
      editDocumentId: docId,
      editClientId: clientId,
      navTo: "clients"
    });
    
    if (typeof goToClient === "function") {
      console.log("🔄 Redirecting to Client Management for document editing...");
      setShowModal(false); // Close modal before navigation
      goToClient();
    } else {
      console.log("⚠️ goToClient function not available");
      alert("⚠️ Navigation function not available. Please go to Client Management manually and look for the client to edit the document.");
    }
  };

  // Calculate summary statistics
  const totalClients = clients.length;
  const totalDocuments = clients.reduce((total, client) => {
    return total + (client.documents ? Object.keys(client.documents).length : 0);
  }, 0);
  
  const clientsWithDocuments = clients.filter(client => 
    client.documents && Object.keys(client.documents).length > 0
  ).length;
  
  const totalYears = new Set(clientRecords.filter(r => r.year !== "No Documents").map(r => r.year)).size;
  
  // Get all unique years for filter dropdown
  const allYears = [...new Set(clientRecords.filter(r => r.year !== "No Documents").map(r => r.year))]
    .sort((a, b) => {
      const aNum = Number(a);
      const bNum = Number(b);
      const aIsNum = !isNaN(aNum);
      const bIsNum = !isNaN(bNum);
      if (aIsNum && bIsNum) return bNum - aNum;
      if (aIsNum) return -1;
      if (bIsNum) return 1;
      return String(a).localeCompare(String(b));
    });
  
  // Filter client records based on search term and year filter
  const filteredClientRecords = useMemo(() => {
    return clientRecords.filter(record => {
      const matchesSearch = !searchTerm || 
        record.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.pan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.documents.some(doc => doc.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesYear = !filterYear || record.year === filterYear;
      
      return matchesSearch && matchesYear;
    });
  }, [clientRecords, searchTerm, filterYear]);

  // 🔹 Pagination setup (same as ClientManagement)
  const totalItems = filteredClientRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageRecords = filteredClientRecords.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredClientRecords.length, pageSize]);

  return (
    <div>
      <h2 className="mb-4">📁 Documents Reports</h2>
      
      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center border-primary h-100">
            <Card.Body>
              <h4 className="text-primary">👥 {totalClients}</h4>
              <small className="text-muted">Total Clients</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-success h-100">
            <Card.Body>
              <h4 className="text-success">📁 {totalDocuments}</h4>
              <small className="text-muted">Total Documents</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-info h-100">
            <Card.Body>
              <h4 className="text-info">📄 {clientsWithDocuments}</h4>
              <small className="text-muted">Clients with Documents</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-warning h-100">
            <Card.Body>
              <h4 className="text-warning">📅 {totalYears}</h4>
              <small className="text-muted">Active Years</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="p-3 shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Client Documents Summary</h5>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setShowModal(false);
              if (typeof goToClient === "function") goToClient();
            }}
            className="px-3 py-2 fw-semibold"
            style={{ 
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(13, 110, 253, 0.2)',
              fontSize: '0.875rem'
            }}
          >
            ➕ Add New Client
          </Button>
        </div>
        
        {/* 🔹 Page Size Selector */}
        <div className="d-flex justify-content-end align-items-center mb-2 gap-2">
          <span className="small text-muted">Show</span>
          <Form.Select
            size="sm"
            style={{ width: 100 }}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </Form.Select>
          <span className="small text-muted">per page</span>
        </div>

        {/* Search and Filter Bar */}
        <Card className="mb-3 shadow-sm">
          <Card.Body className="py-2">
            <Row className="g-2 align-items-center">
              <Col md={4}>
                <Form.Control
                  type="text"
                  placeholder="🔍 Search clients (name, contact, email, PAN, documents)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Col>
              <Col md={3}>
                <Form.Select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  <option value="">📅 All Years</option>
                  {allYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                  <option value="No Documents">No Documents</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterYear("");
                  }}
                >
                  🔄 Clear
                </Button>
              </Col>
              <Col md={1} className="text-end">
                <small className="text-muted">
                  {totalItems > 0 ? `Showing ${pageRecords.length} of ${totalItems}` : "No records"}
                </small>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Table striped bordered hover size="sm">
          <thead>
            <tr>
              <th style={{ width: "60px" }}>Sr. No</th>
              <th>Name</th>
              <th>Year</th>
              <th>Documents</th>
              <th style={{ width: "200px", textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords.map((record, index) => (
              <tr key={`${record.clientId}-${record.year}`}>
                <td className="text-center">
                  <Badge bg="light" text="dark">{startIndex + index + 1}</Badge>
                </td>
                <td>
                  <div className="fw-semibold">{record.clientName}</div>
                  <div className="small text-muted">
                    📞 {record.contact} | 📧 {record.email}
                  </div>
                  {record.pan && (
                    <div className="small">
                      <Badge bg="info" className="mt-1">PAN: {record.pan}</Badge>
                    </div>
                  )}
                </td>
                <td>
                  <Badge 
                    bg={record.year === "No Documents" ? "secondary" : "primary"}
                    className="fs-6"
                  >
                    {record.year}
                  </Badge>
                </td>
                <td>
                  {record.totalDocs > 0 ? (
                    <div>
                      <span className="fw-semibold text-success">{record.totalDocs}</span> document{record.totalDocs > 1 ? 's' : ''}
                      <div className="small text-muted">
                        {record.documents.slice(0, 2).map((doc, idx) => (
                          <div key={idx}>📄 {doc.name}</div>
                        ))}
                        {record.documents.length > 2 && (
                          <div className="text-muted">+{record.documents.length - 2} more...</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted">No documents</span>
                  )}
                </td>
                <td>
                  <div className="d-flex gap-1 justify-content-center align-items-center" style={{ minWidth: '180px' }}>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => openClientDocuments(record)}
                      title="View Documents"
                      disabled={record.totalDocs === 0}
                      className="px-2 py-1"
                      style={{ fontSize: '0.75rem', minWidth: '55px' }}
                    >
                      👁️ View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-warning"
                      onClick={() => handleEditClient(record.clientId)}
                      title="Edit Client"
                      className="px-2 py-1"
                      style={{ fontSize: '0.75rem', minWidth: '50px' }}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => handleDeleteClient(record.clientId, record.clientName)}
                      title="Delete Client"
                      className="px-2 py-1"
                      style={{ fontSize: '0.75rem', minWidth: '60px' }}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredClientRecords.length === 0 && clientRecords.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted">
                  📁 No clients found. 
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => {
                      if (typeof goToClient === "function") goToClient();
                    }}
                  >
                    Add your first client
                  </Button>
                </td>
              </tr>
            )}
            {filteredClientRecords.length === 0 && clientRecords.length > 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted">
                  🔍 No matching clients found for "{searchTerm}" {filterYear && `in year ${filterYear}`}.
                  <br />
                  <Button 
                    variant="outline-primary" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterYear("");
                    }}
                  >
                    🔄 Clear Search
                  </Button>
                  <span className="mx-2">or</span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => {
                      if (typeof goToClient === "function") goToClient();
                    }}
                  >
                    Add your first client
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        {/* 🔹 Pagination */}
        <div className="d-flex justify-content-between align-items-center">
          <div className="text-muted small">
            {totalItems > 0
              ? `Showing ${startIndex + 1}-${endIndex} of ${totalItems}`
              : "No records"}
          </div>
          <Pagination className="mb-0">
            <Pagination.First
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(1)}
            />
            <Pagination.Prev
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            />
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => i + 1)
              .map((_, i) => {
                const pageNum = i + 1;
                return (
                  <Pagination.Item
                    key={pageNum}
                    active={pageNum === safeCurrentPage}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Pagination.Item>
                );
              })}
            {totalPages > 7 && <Pagination.Ellipsis disabled />}
            {totalPages > 7 && (
              <Pagination.Item
                active={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                {totalPages}
              </Pagination.Item>
            )}
            <Pagination.Next
              disabled={safeCurrentPage === totalPages}
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
            />
            <Pagination.Last
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            />
          </Pagination>
        </div>
      </Card>

      {/* Drill-down Modal */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="xl"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            📁 Client Documents - Year: <Badge bg="primary">{selectedYear}</Badge>
            <div className="small text-muted mt-1">
              {yearRows.length} document{yearRows.length !== 1 ? 's' : ''} found
              {yearRows.length > 0 && (
                <span> for {yearRows[0]?.clientName}</span>
              )}
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Table striped bordered hover size="sm" className="mb-3">
            <thead>
              <tr>
                <th>Client Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>PAN</th>
                <th>Document Name</th>
                <th>Year</th>
                <th>File Name</th>
                <th>Upload Date</th>
                <th style={{ width: "140px" }} className="text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="fw-semibold">{row.clientName}</div>
                    <div className="small text-muted">ID: {row.clientId}</div>
                  </td>
                  <td>{row.contact}</td>
                  <td>
                    <div>{row.email}</div>
                  </td>
                  <td>
                    <span className="badge bg-info">{row.pan || 'N/A'}</span>
                  </td>
                  <td>
                    <div className="fw-semibold text-primary">{row.docName}</div>
                  </td>
                  <td>
                    <span className="badge bg-secondary">{row.year}</span>
                  </td>
                  <td>
                    <div className="small">
                      {row.fileName ? (
                        <>
                          📎 {row.fileName}
                          <div className="text-muted" style={{fontSize: '0.7em'}}>
                            {row.fileName.split('.').pop()?.toUpperCase()}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">No file</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="small text-muted">
                      {row.createdAt ? (
                        new Date(row.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric'
                        })
                      ) : 'N/A'}
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="d-flex gap-1 justify-content-center flex-wrap">
                      {row.url && (
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => window.open(row.url, "_blank")}
                          title="View Document"
                        >
                          👁️
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline-warning"
                        onClick={() => {
                          console.log("✏️ Edit document clicked:", row.docId, "for client:", row.clientId);
                          console.log("📋 Row data:", row);
                          handleEditDocument(row.clientId, row.docId);
                        }}
                        title="Edit Document"
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => {
                          console.log("🗑️ Delete document clicked:", row.docId, "for client:", row.clientId);
                          console.log("📋 Row data:", row);
                          handleDeleteDocument(row.clientId, row.docId, row.year, row.docName);
                        }}
                        title="Delete Document"
                      >
                        🗑️
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {yearRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center">
                    No documents found for this year
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Reports;
