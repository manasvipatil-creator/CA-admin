import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Table, Badge, Modal, Form, Alert, Toast, ToastContainer } from 'react-bootstrap';
import { doc, collection } from 'firebase/firestore';
import { db, rtdb } from '../../firebase';
import { ref, set, onValue } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { firestoreHelpers, documentHelpers, clientHelpers } from '../../utils/firestoreHelpers';

const YearManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { client } = location.state || {};
  const { getClientDocRef, getClientYearsRef, getYearDocRef, getYearDocumentsRef, getUserClientPath } = useAuth();
  
  const [years, setYears] = useState([]);
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [showEditYearModal, setShowEditYearModal] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [editYear, setEditYear] = useState("");
  const [originalYear, setOriginalYear] = useState("");
  const [currentClient, setCurrentClient] = useState(client); // Live client data
  
  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  
  // Loading states
  const [isLoadingYears, setIsLoadingYears] = useState(true);
  const [isLoadingDocumentCounts, setIsLoadingDocumentCounts] = useState(false);
  const [isAddingYear, setIsAddingYear] = useState(false);
  const [isEditingYear, setIsEditingYear] = useState(false);
  // Set up real-time listener for client data updates using Firestore
  useEffect(() => {
    if (!client?.id && !client?.pan) {
      setIsLoadingYears(false);
      return;
    }
    
    setIsLoadingYears(true);
    
    // Use client PAN as document ID (client.id should be the PAN)
    const clientPAN = client.pan || client.id;
    const clientName = client.name;
    console.log("🔄 Setting up Firestore listener for client:", clientName, "(PAN:", clientPAN, ")");
    console.log("👤 Client data:", client);
    
    const clientDocRef = getClientDocRef(clientPAN);
    if (!clientDocRef) {
      console.log("⚠️ No client document reference available for PAN:", clientPAN);
      setIsLoadingYears(false);
      return;
    }
    
    const unsubscribe = firestoreHelpers.subscribe(
      clientDocRef,
      (updatedClient) => {
        if (updatedClient) {
          console.log("📊 Client data updated from Firestore:", updatedClient);
          setCurrentClient({ ...updatedClient, id: clientPAN });
          
          // Get years from the client's years array
          const clientYears = updatedClient.years || [];
          
          // Sort years in descending order (extract start year from "YYYY-YY" format)
          clientYears.sort((a, b) => {
            const aYear = parseInt(a.split('-')[0]);
            const bYear = parseInt(b.split('-')[0]);
            return bYear - aYear;
          });
          setYears(clientYears);
          console.log("📅 Years from Firestore:", clientYears);
        } else {
          console.log("❌ Client not found in Firestore for PAN:", clientPAN);
          setYears([]);
        }
        setIsLoadingYears(false);
      },
      (error) => {
        console.error("❌ Firestore client listener error for PAN:", clientPAN, error);
        setYears([]);
        setIsLoadingYears(false);
      }
    );
    
    return () => {
      console.log("🔄 Cleaning up real-time listener for PAN:", clientPAN);
      unsubscribe();
    };
  }, [client]);

  // Initial load of years when component mounts
  useEffect(() => {
    if (client) {
      refreshYearsFromFirestore();
    }
  }, [client]);

  const showSuccessToast = (message) => {
    setToastMessage(message);
    setToastVariant("success");
    setShowToast(true);
  };

  const showErrorToast = (message) => {
    setToastMessage(message);
    setToastVariant("danger");
    setShowToast(true);
  };

  // Function to manually refresh years from Firestore
  const refreshYearsFromFirestore = async () => {
    try {
      setIsLoadingYears(true);
      const clientPAN = client?.pan || client?.id;
      if (!clientPAN) return;
      
      const clientDocRef = getClientDocRef(clientPAN);
      const clientDoc = await firestoreHelpers.get(clientDocRef);
      
      if (clientDoc) {
        const clientYears = clientDoc.years || [];
        clientYears.sort((a, b) => {
          const aYear = parseInt(a.split('-')[0]);
          const bYear = parseInt(b.split('-')[0]);
          return bYear - aYear;
        });
        setYears(clientYears);
        console.log("🔄 Manually refreshed years from Firestore:", clientYears);
      }
    } catch (error) {
      console.error("❌ Error refreshing years:", error);
    } finally {
      setIsLoadingYears(false);
    }
  };

  const handleBack = () => {
    navigate('/admin/clients');
  };

  const handleManageDocuments = (year) => {
    navigate('/admin/documents', {
      state: { client: currentClient, filterYear: year }
    });
  };

  const handleEditYear = (oldYear) => {
    setOriginalYear(oldYear);
    setEditYear(oldYear);
    setShowEditYearModal(true);
  };

  const handleEditYearSubmit = async () => {
    // Validate year format: either "YYYY" or "YYYY-YY"
    const yearRangePattern = /^(\d{4})-(\d{2})$/;
    const singleYearPattern = /^\d{4}$/;
    
    let yearToEdit = editYear.trim();
    let isValidYear = false;
    
    if (yearRangePattern.test(yearToEdit)) {
      // Format: "2023-24"
      const [startYear, endYearShort] = yearToEdit.split('-');
      const startYearNum = parseInt(startYear);
      const endYearNum = parseInt(startYear.substring(0, 2) + endYearShort);
      
      // Validate that end year is start year + 1
      if (endYearNum === startYearNum + 1 && startYearNum >= 1900 && startYearNum <= 2100) {
        isValidYear = true;
      }
    } else if (singleYearPattern.test(yearToEdit)) {
      // Format: "2024" - convert to "2024-25"
      const startYearNum = parseInt(yearToEdit);
      if (startYearNum >= 1900 && startYearNum <= 2099) {
        const endYearShort = ((startYearNum + 1) % 100).toString().padStart(2, '0');
        yearToEdit = `${startYearNum}-${endYearShort}`;
        isValidYear = true;
      }
    }
    
    if (isValidYear && yearToEdit !== originalYear) {
        setIsEditingYear(true);
        try {
          // Check if new year already exists
          if (years.includes(yearToEdit)) {
            showErrorToast(`Year ${yearToEdit} already exists for this client.`);
            setIsEditingYear(false);
            return;
          }
          
          const clientPAN = currentClient?.pan || client?.pan || client?.id;
          if (!clientPAN) {
            throw new Error("Client PAN is required to edit a year");
          }
          
          console.log("✏️ Editing year for client PAN:", clientPAN, "from", originalYear, "to", yearToEdit);
          
          // Get old year document and its documents
          const oldYearDocRef = getYearDocRef(clientPAN, originalYear);
          const oldYearDocumentsRef = getYearDocumentsRef(clientPAN, originalYear);
          
          if (!oldYearDocRef || !oldYearDocumentsRef) {
            throw new Error("Unable to get year references");
          }
          
          // Get old year data and documents
          const oldYearDoc = await firestoreHelpers.get(oldYearDocRef);
          const oldDocuments = await documentHelpers.getDocuments(oldYearDocumentsRef);
          
          if (oldYearDoc) {
            // Create new year document
            const newYearDocRef = getYearDocRef(clientPAN, yearToEdit);
            const newYearDocumentsRef = getYearDocumentsRef(clientPAN, yearToEdit);
            
            if (!newYearDocRef || !newYearDocumentsRef) {
              throw new Error("Unable to get new year references");
            }
            
            // Create new year document with updated year
            const newYearData = {
              ...oldYearDoc,
              year: yearToEdit,
              updatedAt: new Date().toISOString()
            };
            
            await firestoreHelpers.set(newYearDocRef, newYearData);
            
            // Copy all documents to new year
            for (const doc of oldDocuments) {
              const updatedDocData = {
                ...doc,
                year: yearToEdit,
                updatedAt: new Date().toISOString()
              };
              delete updatedDocData.id; // Remove old ID
              await documentHelpers.createDocument(newYearDocumentsRef, updatedDocData);
            }
            
            // Delete old year and its documents
            await firestoreHelpers.delete(oldYearDocRef);
            
            // Update client's years array
            const clientDocRef = getClientDocRef(clientPAN);
            if (clientDocRef) {
              const currentUserData = currentClient || client;
              const existingYears = currentUserData?.years || [];
              
              const updatedYears = existingYears.map(y => y === originalYear ? yearToEdit : y)
                                               .sort((a, b) => {
                                                 const aYear = parseInt(a.split('-')[0]);
                                                 const bYear = parseInt(b.split('-')[0]);
                                                 return bYear - aYear;
                                               });
              await firestoreHelpers.update(clientDocRef, { years: updatedYears });
              console.log("📅 Updated client's years array in Firestore:", updatedYears);
            }
            
            showSuccessToast(`Year updated from ${originalYear} to ${yearToEdit} successfully!`);
            console.log("✅ Year updated successfully in Firestore");
            
            // Close modal and reset form
            setShowEditYearModal(false);
            setEditYear("");
            setOriginalYear("");
            
            // Refresh years from Firestore
            setTimeout(() => {
              refreshYearsFromFirestore();
            }, 1000);
          } else {
            console.log("ℹ️ No data found for the specified year to update");
            showErrorToast("No data found for the specified year.");
          }
        } catch (error) {
          console.error("❌ Error updating year:", error);
          showErrorToast(`Failed to update year: ${error.message}`);
        } finally {
          setIsEditingYear(false);
        }
    } else {
      showErrorToast("Please enter a valid year format (e.g., 2024 or 2023-24) that is different from the current year");
      setIsEditingYear(false);
    }
  };

  const handleDeleteYear = async (year) => {
    const confirmMessage = `⚠️ Are you sure you want to delete year ${year} and all its documents for ${currentClient?.name || client?.name}?\n\nThis action cannot be undone.`;
    if (window.confirm(confirmMessage)) {
      try {
        const clientPAN = currentClient?.pan || client?.pan || client?.id;
        if (!clientPAN) {
          throw new Error("Client PAN is required to delete a year");
        }
        
        console.log("🗑️ Deleting year", year, "for client PAN:", clientPAN);
        
        // Delete the year document from Firestore (this will cascade delete all documents)
        const yearDocRef = getYearDocRef(clientPAN, year);
        if (!yearDocRef) {
          throw new Error("Unable to get year document reference");
        }
        
        await firestoreHelpers.delete(yearDocRef);
        console.log(`🗑️ Deleted year document: ${year}`);
          
        // Remove the year from client's years array
        const clientDocRef = getClientDocRef(clientPAN);
        if (clientDocRef) {
          const currentUserData = currentClient || client;
          const existingYears = currentUserData?.years || [];
          
          if (existingYears.includes(year)) {
            const updatedYears = existingYears.filter(y => y !== year);
            await firestoreHelpers.update(clientDocRef, { years: updatedYears });
            console.log("📅 Updated client's years array in Firestore after deletion:", updatedYears);
          }
        }
          
        showSuccessToast(`Year ${year} deleted successfully!`);
        console.log(`✅ Year ${year} deleted successfully from Firestore`);
        
        // Refresh years from Firestore
        setTimeout(() => {
          refreshYearsFromFirestore();
        }, 1000);
        
        // Navigate back if no years left after deletion
        const remainingYears = years.filter(y => y !== year);
        if (remainingYears.length === 0) {
          setTimeout(() => {
            navigate('/admin/clients', {
              state: {
                message: `All years deleted for ${currentClient?.name || client?.name}`,
                type: 'success'
              }
            });
          }, 1500);
        }
      } catch (error) {
        console.error("❌ Error deleting year:", error);
        showErrorToast(`Failed to delete year: ${error.message}`);
      }
    }
  };

  const handleAddYear = async () => {
    // Validate year format: either "YYYY" or "YYYY-YY"
    const yearRangePattern = /^(\d{4})-(\d{2})$/;
    const singleYearPattern = /^\d{4}$/;
    
    let yearToAdd = newYear.trim();
    let isValidYear = false;
    
    if (yearRangePattern.test(yearToAdd)) {
      // Format: "2023-24"
      const [startYear, endYearShort] = yearToAdd.split('-');
      const startYearNum = parseInt(startYear);
      const endYearNum = parseInt(startYear.substring(0, 2) + endYearShort);
      
      // Validate that end year is start year + 1
      if (endYearNum === startYearNum + 1 && startYearNum >= 1900 && startYearNum <= 2100) {
        isValidYear = true;
      }
    } else if (singleYearPattern.test(yearToAdd)) {
      // Format: "2024" - convert to "2024-25"
      const startYearNum = parseInt(yearToAdd);
      if (startYearNum >= 1900 && startYearNum <= 2099) {
        const endYearShort = ((startYearNum + 1) % 100).toString().padStart(2, '0');
        yearToAdd = `${startYearNum}-${endYearShort}`;
        isValidYear = true;
      }
    }
    
    if (isValidYear) {
        setIsAddingYear(true);
        try {
          // Check if year already exists
          if (years.includes(yearToAdd)) {
            showErrorToast(`Year ${yearToAdd} already exists for this client.`);
            return;
          }
          
          // Get the client PAN (use the client PAN as document ID)
          const clientPAN = currentClient?.pan || client?.pan || client?.id;
          const clientName = currentClient?.name || client?.name;
          
          if (!clientPAN) {
            throw new Error("Client PAN is required to add a year");
          }
          
          console.log("➕ Adding year for client:", clientName, "(PAN:", clientPAN, ")");
          
          // Create year document in Firestore
          // Structure: {safeEmail}/user/clients/{clientPAN}/years/{year}
          const yearData = {
            year: yearToAdd,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            documentCount: 0,
            status: "active"
          };
          
          // Get year document reference using client PAN
          const yearDocRef = getYearDocRef(clientPAN, yearToAdd);
          if (!yearDocRef) {
            throw new Error("Unable to get year document reference");
          }
          
          console.log("💾 Creating year document in Firestore:", yearData);
          
          // Save the year document to Firestore
          await firestoreHelpers.set(yearDocRef, yearData);
          
          // Update the client's years array using client PAN
          const clientDocRef = getClientDocRef(clientPAN);
          if (clientDocRef) {
            const currentUserData = currentClient || client;
            const existingYears = currentUserData?.years || [];
            
            if (!existingYears.includes(yearToAdd)) {
              const updatedYears = [...existingYears, yearToAdd].sort((a, b) => {
                // Extract start year from format "YYYY-YY"
                const aYear = parseInt(a.split('-')[0]);
                const bYear = parseInt(b.split('-')[0]);
                return bYear - aYear;
              });
              await firestoreHelpers.update(clientDocRef, { years: updatedYears });
              console.log("📅 Updated client's years array in Firestore for PAN:", clientPAN, "Years:", updatedYears);
            }
          }
          
          showSuccessToast(`Year ${yearToAdd} added successfully!`);
          console.log(`✅ Year ${yearToAdd} added successfully to Firestore`);
          
          // Manually update local years state to ensure UI updates immediately
          const currentUserData = currentClient || client;
          const existingYears = currentUserData?.years || [];
          if (!existingYears.includes(yearToAdd)) {
            const updatedYears = [...existingYears, yearToAdd].sort((a, b) => {
              const aYear = parseInt(a.split('-')[0]);
              const bYear = parseInt(b.split('-')[0]);
              return bYear - aYear;
            });
            setYears(updatedYears);
            console.log("🔄 Manually updated local years state:", updatedYears);
          }
          
          // Also refresh from Firestore to ensure data consistency
          setTimeout(() => {
            refreshYearsFromFirestore();
          }, 1000);
          
          // Close modal and reset form
          setShowAddYearModal(false);
          setNewYear("");
          
        } catch (error) {
          console.error("❌ Error adding year:", error);
          showErrorToast("Failed to add year. Please try again.");
        } finally {
          setIsAddingYear(false);
        }
    } else {
      showErrorToast("Please enter a valid year format (e.g., 2024 or 2023-24)");
      setIsAddingYear(false);
    }
  };

  // State to store document counts for each year
  const [documentCounts, setDocumentCounts] = useState({});

  // Function to get document count from Firestore for a specific year
  const getDocumentCount = async (year) => {
    try {
      const clientPAN = currentClient?.pan || client?.pan || client?.id;
      if (!clientPAN) return 0;
      
      const documentsRef = getYearDocumentsRef(clientPAN, year);
      if (!documentsRef) return 0;
      
      const docs = await documentHelpers.getDocuments(documentsRef);
      
      // Filter out placeholder and empty documents
      const realDocuments = docs.filter(doc => 
        doc && 
        doc.fileName && 
        doc.fileName !== "placeholder.txt" && 
        (doc.docName || doc.name) && 
        !(doc.docName || doc.name).includes("Initial Setup") &&
        !(doc.docName || doc.name).includes("Year 20")
      );
      
      return realDocuments.length;
    } catch (error) {
      console.error("❌ Error getting document count for year", year, ":", error);
      return 0;
    }
  };

  // Load document counts for all years when years change
  useEffect(() => {
    const loadDocumentCounts = async () => {
      if (years.length > 0) {
        setIsLoadingDocumentCounts(true);
        const counts = {};
        for (const year of years) {
          counts[year] = await getDocumentCount(year);
        }
        setDocumentCounts(counts);
        console.log("📊 Document counts loaded:", counts);
        setIsLoadingDocumentCounts(false);
      } else {
        setIsLoadingDocumentCounts(false);
      }
    };
    
    loadDocumentCounts();
  }, [years, currentClient]);

  // Refresh document counts when component becomes visible (user returns from document management)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && years.length > 0) {
        console.log("📊 Page became visible, refreshing document counts...");
        setTimeout(async () => {
          const counts = {};
          for (const year of years) {
            counts[year] = await getDocumentCount(year);
          }
          setDocumentCounts(counts);
          console.log("📊 Document counts refreshed on visibility change:", counts);
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [years]);

  // Function to get cached document count (synchronous)
  const getCachedDocumentCount = (year) => {
    return documentCounts[year] || 0;
  };

  // Function to refresh document count for a specific year
  const refreshDocumentCount = async (year) => {
    const count = await getDocumentCount(year);
    setDocumentCounts(prev => ({
      ...prev,
      [year]: count
    }));
    console.log(`📊 Refreshed document count for year ${year}: ${count}`);
  };

  return (
    <div>
      <h3 className="mb-3">📅 Year Management - {client?.name}</h3>
      
      {/* Instructions */}
      <div className="alert alert-info mb-3" style={{ 
        borderRadius: '12px', 
        border: 'none', 
        background: 'linear-gradient(45deg, #e3f2fd, #f3e5f5)' 
      }}>
        <div className="d-flex align-items-center">
          <div style={{ fontSize: '1.5rem', marginRight: '12px' }}>💡</div>
          <div>
            <strong>How to view documents:</strong> Click on the <strong>Year badge</strong>, <strong>Document count</strong>, or <strong>View button</strong> to see documents for that year.
          </div>
        </div>
      </div>
      
      {/* Client Info Card - Same as Client Management */}
      <Card className="mb-2 shadow-sm">
        <Card.Body className="py-2">
          <div className="d-flex justify-content-between align-items-center">
            <div className="small text-muted">
              <strong>Contact:</strong> {client?.contact} | <strong>Email:</strong> {client?.email} | <strong>PAN:</strong> {client?.pan}
            </div>
            <Button variant="outline-primary" size="sm" onClick={handleBack}>
              ← Back to Client Management
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Section Header - Same as Client Management */}
      <Card className="mb-3">
        <Card.Body className="py-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0">Years</h5>
              <small className="text-muted">Manage years for {client?.name}</small>
            </div>
            <div className="d-flex gap-2">
              <Button variant="success" onClick={() => setShowAddYearModal(true)}>
                ➕ Add New Year
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Years Table - Enhanced Structure */}
      <div className="table-responsive shadow-sm rounded">
        <Table hover className="mb-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <thead style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <tr>
              <th style={{ 
                padding: '16px 20px', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                border: 'none',
                letterSpacing: '0.5px',
                textAlign: 'center'
              }}>
                📅 Years
              </th>
              <th style={{ 
                padding: '16px 20px', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                border: 'none',
                letterSpacing: '0.5px',
                textAlign: 'center'
              }}>
                📄 Documents
              </th>
              <th style={{ 
                padding: '16px 20px', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                border: 'none',
                letterSpacing: '0.5px',
                textAlign: 'center'
              }}>
                ⚡ Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoadingYears ? (
              <tr>
                <td colSpan="3" style={{ 
                  padding: '60px 20px', 
                  textAlign: 'center',
                  border: 'none'
                }}>
                  <div className="d-flex flex-column align-items-center">
                    <div className="spinner-border text-primary mb-3" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div className="h5 text-muted mb-2">Loading years...</div>
                    <div className="text-muted">Please wait while we fetch year data</div>
                  </div>
                </td>
              </tr>
            ) : years.map((year, index) => {
              const docCount = getCachedDocumentCount(year);
              return (
                <tr key={year} style={{
                  backgroundColor: index % 2 === 0 ? '#f8f9ff' : 'white',
                  transition: 'all 0.3s ease',
                  borderLeft: '4px solid transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e3f2fd';
                  e.currentTarget.style.borderLeft = '4px solid #2196f3';
                  e.currentTarget.style.transform = 'translateX(2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#f8f9ff' : 'white';
                  e.currentTarget.style.borderLeft = '4px solid transparent';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}>
                  <td style={{ 
                    padding: '16px 20px', 
                    textAlign: 'center',
                    border: 'none',
                    borderBottom: '1px solid #e9ecef'
                  }}>
                    <div className="d-flex align-items-center justify-content-center">
                      <Badge 
                        style={{
                          background: 'linear-gradient(45deg, #667eea, #764ba2)',
                          fontSize: '1rem',
                          padding: '8px 16px',
                          borderRadius: '12px',
                          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        onClick={() => handleManageDocuments(year)}
                        title={`Click to view ${docCount} documents for year ${year}`}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                        }}
                      >
                        {year}
                      </Badge>
                      {year === new Date().getFullYear().toString() && (
                        <div className="ms-2">
                          <small className="badge bg-success" style={{ fontSize: '0.7rem' }}>Current</small>
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ 
                    padding: '16px 20px', 
                    textAlign: 'center',
                    border: 'none',
                    borderBottom: '1px solid #e9ecef'
                  }}>
                    {isLoadingDocumentCounts ? (
                      <div className="d-flex align-items-center">
                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <span className="text-muted">Loading...</span>
                      </div>
                    ) : (
                      <Badge 
                        style={{
                          background: docCount > 0 
                            ? 'linear-gradient(45deg, #17a2b8, #20c997)' 
                            : 'linear-gradient(45deg, #6c757d, #495057)',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          padding: '8px 16px',
                          borderRadius: '12px',
                          boxShadow: docCount > 0 
                            ? '0 2px 8px rgba(23, 162, 184, 0.3)' 
                            : '0 2px 8px rgba(108, 117, 125, 0.3)',
                          transition: 'all 0.3s ease'
                        }}
                        onClick={() => handleManageDocuments(year)}
                        title="Click to manage documents"
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = docCount > 0 
                            ? '0 4px 12px rgba(23, 162, 184, 0.4)' 
                            : '0 4px 12px rgba(108, 117, 125, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = docCount > 0 
                            ? '0 2px 8px rgba(23, 162, 184, 0.3)' 
                            : '0 2px 8px rgba(108, 117, 125, 0.3)';
                        }}
                      >
                        📄 {docCount} {docCount === 1 ? 'Document' : 'Documents'}
                      </Badge>
                    )}
                  </td>
                  <td style={{ 
                    padding: '16px 20px', 
                    textAlign: 'center',
                    border: 'none',
                    borderBottom: '1px solid #e9ecef'
                  }}>
                    <div className="d-flex gap-2 justify-content-center">
                      <Button
                        variant="info"
                        size="sm"
                        onClick={() => handleManageDocuments(year)}
                        title="View documents for this year"
                        style={{
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontWeight: '500',
                          border: 'none',
                          background: 'linear-gradient(45deg, #17a2b8, #138496)',
                          boxShadow: '0 2px 6px rgba(23,162,184,0.3)',
                          transition: 'all 0.3s ease',
                          color: 'white'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 10px rgba(23,162,184,0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 6px rgba(23,162,184,0.3)';
                        }}
                      >
                        👁️ View
                      </Button>
                      <Button
                        variant="warning"
                        size="sm"
                        onClick={() => handleEditYear(year)}
                        title="Edit this year"
                        style={{
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontWeight: '500',
                          border: 'none',
                          background: 'linear-gradient(45deg, #ffc107, #e0a800)',
                          boxShadow: '0 2px 6px rgba(255,193,7,0.3)',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 10px rgba(255,193,7,0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 6px rgba(255,193,7,0.3)';
                        }}
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteYear(year)}
                        title="Delete this year and all its documents"
                        style={{
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontWeight: '500',
                          border: 'none',
                          background: 'linear-gradient(45deg, #dc3545, #c82333)',
                          boxShadow: '0 2px 6px rgba(220,53,69,0.3)',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 10px rgba(220,53,69,0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 6px rgba(220,53,69,0.3)';
                        }}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoadingYears && years.length === 0 && (
              <tr>
                <td colSpan="3" style={{ 
                  padding: '40px 20px', 
                  textAlign: 'center',
                  color: '#6c757d',
                  fontSize: '1.1rem',
                  border: 'none'
                }}>
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📅</div>
                    <div style={{ fontWeight: '500', marginBottom: '8px' }}>No years found</div>
                    <div style={{ fontSize: '0.9rem', color: '#adb5bd' }}>Click "Add New Year" to get started</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Add New Year Modal */}
      <Modal show={showAddYearModal} onHide={() => setShowAddYearModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>📅 Add New Year</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label><strong>📅 Enter New Year</strong></Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., 2023-24, 2024-25, or 2024"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                autoFocus
              />
              <Form.Text className="text-muted">
                Enter year in format YYYY-YY (e.g., 2023-24) or YYYY (will be converted to YYYY-YY)
              </Form.Text>
            </Form.Group>
            
            <div className="bg-light p-3 rounded mb-3">
              <h6 className="mb-2">👤 Client Information</h6>
              <div><strong>Name:</strong> {client?.name}</div>
              <div><strong>PAN:</strong> {client?.pan}</div>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddYearModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddYear}
            disabled={!newYear || isAddingYear}
          >
            {isAddingYear ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Adding...
              </>
            ) : (
              '➕ Add Year'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Year Modal */}
      <Modal show={showEditYearModal} onHide={() => setShowEditYearModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>✏️ Edit Year</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label><strong>📅 Edit Year</strong></Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., 2023-24, 2024-25, or 2024"
                value={editYear}
                onChange={(e) => setEditYear(e.target.value)}
                autoFocus
              />
              <Form.Text className="text-muted">
                Enter year in format YYYY-YY (e.g., 2023-24) or YYYY (will be converted to YYYY-YY)
              </Form.Text>
            </Form.Group>
            
            <div className="bg-light p-3 rounded mb-3">
              <h6 className="mb-2">👤 Client Information</h6>
              <div><strong>Name:</strong> {currentClient?.name || client?.name}</div>
              <div><strong>PAN:</strong> {currentClient?.pan || client?.pan}</div>
              <div><strong>Current Year:</strong> {originalYear}</div>
            </div>

            {editYear && editYear !== originalYear && (
              <div className="bg-warning bg-opacity-10 border border-warning rounded p-3 mb-3">
                <div className="d-flex align-items-center">
                  <div className="text-warning me-2">⚠️</div>
                  <div>
                    <strong>Year Change:</strong> {originalYear} → {editYear}
                    <br />
                    <small className="text-muted">All documents will be moved to the new year.</small>
                  </div>
                </div>
              </div>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowEditYearModal(false);
              setEditYear("");
              setOriginalYear("");
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="warning" 
            onClick={handleEditYearSubmit}
            disabled={!editYear || editYear === originalYear || isEditingYear}
          >
            {isEditingYear ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Updating...
              </>
            ) : (
              '✏️ Update Year'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Toast Notifications */}
      <ToastContainer position="top-end" className="p-3">
        <Toast
          show={showToast}
          onClose={() => setShowToast(false)}
          delay={4000}
          autohide
          bg={toastVariant}
        >
          <Toast.Header>
            <strong className="me-auto">
              {toastVariant === "success" ? "✅ Success" : "❌ Error"}
            </strong>
          </Toast.Header>
          <Toast.Body className="text-white">
            {toastMessage}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
};

export default YearManagement;
