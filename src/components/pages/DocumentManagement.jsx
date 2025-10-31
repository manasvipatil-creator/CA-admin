import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Table, Badge, Modal, Form, Row, Col, Toast, ToastContainer } from 'react-bootstrap';
import { db, rtdb, storage } from '../../firebase';
import { doc as firestoreDoc, deleteDoc } from 'firebase/firestore';
import { ref, set, onValue, get, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from '../../contexts/AuthContext';
import { documentHelpers, firestoreHelpers } from '../../utils/firestoreHelpers';

const DocumentManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { client, filterYear } = location.state || {};
  const { getYearDocumentsRef, getClientDocRef, getSafeEmail, getUserClientPath } = useAuth();

  // Check if client exists, if not redirect back
  useEffect(() => {
    if (!client) {
      console.error("❌ No client data found, redirecting to client management");
      navigate('/admin/clients');
      return;
    }
  }, [client, navigate]);
  
  // Ensure we use current year if filterYear is invalid or not provided
  const currentYear = new Date().getFullYear().toString();
  const validFilterYear = filterYear && filterYear >= 1900 && filterYear <= 2100 ? filterYear : null;
  
  const [documents, setDocuments] = useState([]);
  const [showDocForm, setShowDocForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [editingDocId, setEditingDocId] = useState(null);
  const [docForm, setDocForm] = useState({
    files: [], // Array of file objects: {file, fileName, docName, year, localPreviewUrl}
  });
  
  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  
  // Loading state for save button
  const [isSaving, setIsSaving] = useState(false);
  
  // Loading state for view document modal
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  
  // Loading state for document list
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  
  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);

  // This useEffect is replaced by the Firestore-based loading in the later useEffect

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

  const handleBack = () => {
    navigate('/admin/years', {
      state: { client }
    });
  };

  const handleAddDocument = () => {
    console.log("Current year:", currentYear);
    console.log("Filter year:", filterYear);
    console.log("Valid filter year:", validFilterYear);
    
    setDocForm({
      files: [],
    });
    setEditingDocId(null);
    setShowDocForm(true);
  };

  const handleViewDocument = (doc) => {
    setIsLoadingDocument(true);
    setViewingDoc(doc);
    setShowViewModal(true);
    
    // Show loading for documents that need to be fetched from Firebase Storage
    // or for large files that don't have inline fileData
    const needsLoading = !doc.fileData && doc.fileUrl;
    const loadingTime = needsLoading ? 1200 : 500; // Longer for remote files
    
    setTimeout(() => {
      setIsLoadingDocument(false);
    }, loadingTime);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setIsLoadingDocument(false);
    setViewingDoc(null);
  };

  const handleEditDocument = (doc) => {
    setDocForm({
      files: [{
        file: null,
        fileName: doc.fileName || "",
        docName: doc.name || doc.docName || "",
        year: doc.year || "",
        localPreviewUrl: doc.fileData || "",
        id: `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        existingDoc: true
      }],
    });
    setEditingDocId(doc.id);
    setShowDocForm(true);
  };

  const handleDeleteDocument = async (doc) => {
    const confirmMessage = `⚠️ Are you sure you want to delete "${doc.name || doc.docName}"?\n\nThis action cannot be undone.`;
    if (window.confirm(confirmMessage)) {
      try {
        console.log("🗑️ Deleting document:", doc.id, "from client:", client);
        
        // Get client PAN for Firestore operations
        const clientPAN = client.pan || client.id;
        if (!clientPAN) {
          throw new Error("Client PAN is required to delete document");
        }
        
        console.log("🔑 Using client PAN:", clientPAN, "Year:", doc.year);
        
        // Delete document from Firestore
        const documentsRef = getYearDocumentsRef(clientPAN, doc.year);
        if (!documentsRef) {
          throw new Error("Unable to get documents collection reference");
        }
        
        const docRef = firestoreDoc(documentsRef, doc.id);
        await firestoreHelpers.delete(docRef);
        
        showSuccessToast(`Document "${doc.name || doc.docName}" deleted successfully!`);
        
        // Update local state immediately
        const updatedDocuments = documents.filter(d => d.id !== doc.id);
        setDocuments(updatedDocuments);
        
        // Refresh from Firestore to ensure consistency
        setTimeout(async () => {
          try {
            if (filterYear) {
              const documentsRef = getYearDocumentsRef(clientPAN, filterYear);
              if (documentsRef) {
                const docs = await documentHelpers.getDocuments(documentsRef);
                setDocuments(docs);
                console.log("✅ Documents refreshed from Firestore after delete:", docs.length, "documents");
              }
            }
          } catch (refreshError) {
            console.error("❌ Error refreshing documents after delete:", refreshError);
          }
        }, 500);
        
      } catch (error) {
        console.error("❌ Error deleting document:", error);
        showErrorToast(`Failed to delete document: ${error.message}`);
      }
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      const newFiles = selectedFiles.map(file => {
        // Extract file name without extension for document name
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        
        return {
          file: file,
          fileName: file.name,
          docName: fileNameWithoutExt,
          year: filterYear || "", // Use current filter year as default
          localPreviewUrl: URL.createObjectURL(file),
          id: `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}` // Temporary ID for tracking
        };
      });
      
      setDocForm({
        ...docForm,
        files: [...docForm.files, ...newFiles],
      });
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles && droppedFiles.length > 0) {
      const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
      const validFiles = [];
      const invalidFiles = [];
      
      droppedFiles.forEach(file => {
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (allowedTypes.includes(fileExtension)) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      });
      
      if (validFiles.length > 0) {
        const newFiles = validFiles.map(file => {
          // Extract file name without extension for document name
          const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          
          return {
            file: file,
            fileName: file.name,
            docName: fileNameWithoutExt,
            year: filterYear || "", // Use current filter year as default
            localPreviewUrl: URL.createObjectURL(file),
            id: `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}` // Temporary ID for tracking
          };
        });
        
        setDocForm({
          ...docForm,
          files: [...docForm.files, ...newFiles],
        });
      }
      
      if (invalidFiles.length > 0) {
        showErrorToast(`Invalid file types: ${invalidFiles.join(', ')}. Please upload PDF, JPG, PNG, DOC, or DOCX files.`);
      }
    }
  };

  // Function to remove a file from the selection
  const handleRemoveFile = (fileId) => {
    setDocForm({
      ...docForm,
      files: docForm.files.filter(file => file.id !== fileId)
    });
  };

  // Function to update document name for a specific file
  const handleUpdateDocName = (fileId, newDocName) => {
    setDocForm({
      ...docForm,
      files: docForm.files.map(file => 
        file.id === fileId ? { ...file, docName: newDocName } : file
      )
    });
  };

  // Function to update year for a specific file
  const handleUpdateYear = (fileId, newYear) => {
    setDocForm({
      ...docForm,
      files: docForm.files.map(file => 
        file.id === fileId ? { ...file, year: newYear } : file
      )
    });
  };

  const handleSaveDocument = async () => {
    setIsSaving(true);
    try {
      // Safety check for client
      if (!client || !client.id) {
        console.error("❌ Client data is missing");
        showErrorToast("Client data is missing. Please go back and select a client.");
        setIsSaving(false);
        return;
      }

      if (docForm.files.length === 0) {
        showErrorToast("Please select at least one file");
        setIsSaving(false);
        return;
      }

      // Check if all files have document names and years
      const filesWithoutNames = docForm.files.filter(file => !file.docName.trim());
      const filesWithoutYears = docForm.files.filter(file => !file.year.trim());
      
      if (filesWithoutNames.length > 0) {
        showErrorToast("Please provide document names for all files");
        setIsSaving(false);
        return;
      }
      
      if (filesWithoutYears.length > 0) {
        showErrorToast("Please provide year for all files");
        setIsSaving(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Process each file
      for (const fileObj of docForm.files) {
        try {
          // Skip if it's an existing document being edited without a new file
          if (editingDocId && !fileObj.file) {
            // Update existing document metadata only
            const clientPAN = client.pan || client.id;
            const documentsRef = getYearDocumentsRef(clientPAN, fileObj.year);
            if (!documentsRef) {
              throw new Error("Unable to get documents collection reference");
            }
            
            const updatedDoc = {
              name: fileObj.docName,
              docName: fileObj.docName,
              year: fileObj.year,
              updatedAt: new Date().toISOString(),
            };

            const docRef = firestoreDoc(documentsRef, editingDocId);
            await firestoreHelpers.update(docRef, updatedDoc);
            
            successCount++;
            continue;
          }

          if (!fileObj.file) continue;

          let fileUrl = null;
          let fileName = fileObj.fileName;

          // Upload file to Firebase Storage if file exists
          if (fileObj.file) {
            try {
              console.log("📤 Uploading file to Firebase Storage...");
              const timestamp = Date.now();
              const randomSuffix = Math.floor(Math.random() * 10000);
              const fileExtension = fileObj.file.name.split('.').pop();
              const storageFileName = `${timestamp}_${randomSuffix}_${fileObj.docName.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
              
              // Create storage reference
              const clientName = client.name || client.id;
              const fileRef = storageRef(storage, `documents/${clientName}/${fileObj.year}/${storageFileName}`);
              
              // Upload file
              const snapshot = await uploadBytes(fileRef, fileObj.file);
              fileUrl = await getDownloadURL(snapshot.ref);
              fileName = storageFileName;
              
              console.log("✅ File uploaded successfully:", fileUrl);
            } catch (uploadError) {
              console.error("❌ File upload failed:", uploadError);
              // Continue without file URL but save document metadata
            }
          }

          // Only store base64 data for small files (under 500KB) to avoid Firestore size limits
          const maxFileDataSize = 500 * 1024; // 500KB
          const shouldStoreFileData = fileObj.file?.size && fileObj.file.size < maxFileDataSize;
          
          const docData = {
            name: fileObj.docName,
            docName: fileObj.docName,
            year: fileObj.year,
            fileName: fileObj.fileName,
            fileUrl: fileUrl, // Firebase Storage URL - primary source for file access
            fileData: shouldStoreFileData ? fileObj.localPreviewUrl : null, // Only for small files
            fileSize: fileObj.file?.size,
            fileType: fileObj.file?.type,
            uploadedAt: new Date().toISOString(),
            uploadedBy: "admin"
          };
          
          console.log(`📊 File size: ${fileObj.file?.size} bytes, storing fileData: ${shouldStoreFileData}`);

          // Get client PAN for Firestore structure (PAN is used as document ID)
          const clientPAN = client.pan || client.id;
          const clientName = client.name;
          console.log("💾 Saving document for client:", clientName, "(PAN:", clientPAN, ")");
          console.log("💾 Document data:", docData);
          
          // Get Firestore documents collection reference using client PAN
          const documentsRef = getYearDocumentsRef(clientPAN, fileObj.year);
          if (!documentsRef) {
            throw new Error("Unable to get documents collection reference");
          }
          
          if (editingDocId) {
            // Update existing document in Firestore
            const docRef = firestoreDoc(documentsRef, editingDocId);
            await firestoreHelpers.update(docRef, docData);
            console.log("✅ Document updated in Firestore:", editingDocId);
          } else {
            // Add new document to Firestore
            const docRef = await documentHelpers.createDocument(documentsRef, docData);
            console.log("✅ New document added to Firestore:", docRef.id, "in year:", fileObj.year);
          }

          successCount++;
        } catch (fileError) {
          console.error(`❌ Error saving file ${fileObj.fileName}:`, fileError);
          errorCount++;
        }
      }

      // Show appropriate success/error message
      if (successCount > 0 && errorCount === 0) {
        if (editingDocId) {
          showSuccessToast(`Document updated successfully!`);
        } else {
          showSuccessToast(`${successCount} document${successCount > 1 ? 's' : ''} saved successfully!`);
        }
      } else if (successCount > 0 && errorCount > 0) {
        showSuccessToast(`${successCount} document${successCount > 1 ? 's' : ''} saved successfully. ${errorCount} failed.`);
      } else {
        showErrorToast("Failed to save documents. Please try again.");
      }

      setShowDocForm(false);
      
      // Reset form
      setDocForm({
        files: [],
      });
      setEditingDocId(null);
      setIsSaving(false);
      
      // Refresh documents list from Firestore
      if (filterYear) {
        const clientPAN = client.pan || client.id;
        const documentsRef = getYearDocumentsRef(clientPAN, filterYear);
        if (documentsRef) {
          try {
            const docs = await documentHelpers.getDocuments(documentsRef);
            setDocuments(docs);
            console.log("🔄 Refreshed documents from Firestore:", docs.length, "documents");
          } catch (error) {
            console.error("❌ Error refreshing documents:", error);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error saving document:", error);
      showErrorToast("Failed to save document. Please try again.");
      setIsSaving(false);
    }
  };

  // Load documents from Firestore when component mounts or filterYear changes
  useEffect(() => {
    if (client && filterYear) {
      const loadDocuments = async () => {
        setIsLoadingDocuments(true);
        try {
          const clientPAN = client.pan || client.id;
          const documentsRef = getYearDocumentsRef(clientPAN, filterYear);
          if (documentsRef) {
            const docs = await documentHelpers.getDocuments(documentsRef);
            setDocuments(docs);
            console.log("📄 Loaded documents from Firestore:", docs.length, "documents");
          }
        } catch (error) {
          console.error("❌ Error loading documents:", error);
          setDocuments([]);
        } finally {
          setIsLoadingDocuments(false);
        }
      };
      
      loadDocuments();
    } else {
      // Reset loading state if no client or filterYear
      setIsLoadingDocuments(false);
      setDocuments([]);
    }
  }, [client, filterYear, getYearDocumentsRef]);

  // Helper functions (handleBack already defined above)

  // Filter out placeholder documents and show only real documents
  const realDocuments = documents.filter(doc => 
    doc.fileName !== "placeholder.txt" && 
    (doc.docName || doc.name) && 
    !(doc.docName || doc.name).includes("Initial Setup") &&
    !(doc.docName || doc.name).includes("Year 20")
  );
  
  console.log("🔍 Total documents:", documents.length);
  console.log("🔍 Real documents after filter:", realDocuments.length);
  
  const filteredDocuments = filterYear 
    ? realDocuments.filter(doc => doc.year === filterYear.toString())
    : realDocuments;

  return (
    <div>
      <h3 className="mb-3">📁 Documents - {client?.name} {filterYear && `(Year: ${filterYear})`}</h3>
      
      {/* Client Info Card - Same as Client Management */}
      <Card className="mb-2 shadow-sm">
        <Card.Body className="py-2">
          <div className="d-flex justify-content-between align-items-center">
            <div className="small text-muted">
              <strong>Contact:</strong> {client?.contact} | <strong>Email:</strong> {client?.email} | <strong>PAN:</strong> {client?.pan}
              {filterYear && <span> | <strong>Year:</strong> {filterYear}</span>}
            </div>
            <Button variant="outline-success" size="sm" onClick={handleBack}>
              ← Back to Year Management
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Section Header - Same as Client Management */}
      <Card className="mb-3">
        <Card.Body className="py-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0">Documents {filterYear && `for Year ${filterYear}`}</h5>
              <small className="text-muted">Manage documents for {client?.name}</small>
            </div>
            <Button variant="success" onClick={handleAddDocument}>
              ➕ Add Document
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Documents Table - Enhanced Structure */}
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
                letterSpacing: '0.5px'
              }}>
                📄 Document Name
              </th>
              <th style={{ 
                padding: '16px 20px', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                border: 'none',
                letterSpacing: '0.5px',
                textAlign: 'center'
              }}>
                📅 Uploaded
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
            {isLoadingDocuments ? (
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
                    <div className="h5 text-muted mb-2">Loading documents...</div>
                    <div className="text-muted">Please wait while we fetch your documents</div>
                  </div>
                </td>
              </tr>
            ) : filteredDocuments.map((doc, index) => (
              <tr key={doc.id} style={{
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
                  fontWeight: '500',
                  color: '#2c3e50',
                  border: 'none',
                  borderBottom: '1px solid #e9ecef'
                }}>
                  <div className="d-flex align-items-center">
                    <div style={{
                      width: '32px',
                      height: '32px',
                      background: 'linear-gradient(45deg, #667eea, #764ba2)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px',
                      fontSize: '14px',
                      color: 'white'
                    }}>
                      📄
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: '600' }}>{doc.name || doc.docName}</div>
                    </div>
                  </div>
                </td>
                <td style={{ 
                  padding: '16px 20px', 
                  textAlign: 'center',
                  color: '#495057',
                  border: 'none',
                  borderBottom: '1px solid #e9ecef'
                }}>
                  <div className="d-flex align-items-center justify-content-center">
                    <span className="badge bg-light text-dark me-2">📅</span>
                    <span style={{ fontSize: '0.9rem' }}>
                      {doc.uploadedAt 
                        ? new Date(doc.uploadedAt).toLocaleDateString()
                        : doc.createdAt 
                          ? new Date(doc.createdAt.toDate()).toLocaleDateString()
                          : 'N/A'
                      }
                    </span>
                  </div>
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
                      onClick={() => handleViewDocument(doc)}
                      title="View document"
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
                      onClick={() => handleEditDocument(doc)}
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
                      onClick={() => handleDeleteDocument(doc)}
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
            ))}
            {!isLoadingDocuments && filteredDocuments.length === 0 && (
              <tr>
                <td colSpan="3" style={{ 
                  padding: '40px 20px', 
                  textAlign: 'center',
                  color: '#6c757d',
                  fontSize: '1.1rem',
                  border: 'none'
                }}>
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📄</div>
                    <div style={{ fontWeight: '500', marginBottom: '8px' }}>No documents found</div>
                    <div style={{ fontSize: '0.9rem', color: '#adb5bd' }}>Click "Add Document" to get started</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Document Form Modal */}
      <Modal show={showDocForm} onHide={() => setShowDocForm(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingDocId ? '✏️ Edit Document' : '➕ Add New Document'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label><strong>📎 Upload Files</strong></Form.Label>
              
              {/* Drag and Drop Zone */}
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragging ? '3px dashed #007bff' : '2px dashed #dee2e6',
                  borderRadius: '12px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  backgroundColor: isDragging ? '#e7f3ff' : '#f8f9fa',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                }}
                onClick={() => document.getElementById('fileInput').click()}
              >
                <input
                  id="fileInput"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  multiple
                  style={{ display: 'none' }}
                />
                
                {docForm.files.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
                    <div className="fw-bold text-success mb-2">
                      {docForm.files.length} File{docForm.files.length > 1 ? 's' : ''} Selected
                    </div>
                    <div className="text-muted mb-2">
                      {docForm.files.map(file => file.fileName).join(', ')}
                    </div>
                    <div className="mt-2">
                      <small className="text-primary">Click to add more files</small>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
                      {isDragging ? '📥' : '📁'}
                    </div>
                    <div className="fw-bold mb-2">
                      {isDragging ? 'Drop files here' : 'Drag & Drop files here'}
                    </div>
                    <div className="text-muted mb-2">or</div>
                    <Button variant="outline-primary" size="sm">
                      Browse Files
                    </Button>
                  </div>
                )}
              </div>
              
              <Form.Text className="text-muted d-block mt-2">
                <i className="bi bi-info-circle"></i> Supported formats: PDF, JPG, PNG, DOC, DOCX. Files larger than 500KB will be stored in cloud storage.
              </Form.Text>
            </Form.Group>

            {/* Selected Files List */}
            {docForm.files.length > 0 && (
              <div className="mb-3">
                <Form.Label><strong>Selected Files ({docForm.files.length})</strong></Form.Label>
                <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa', maxHeight: '400px', overflowY: 'auto' }}>
                  {docForm.files.map((fileObj, index) => (
                    <div key={fileObj.id} className="mb-3 p-3 border rounded bg-white">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="flex-grow-1">
                          <div className="fw-bold text-primary mb-1">📎 {fileObj.fileName}</div>
                          <div className="small text-muted">
                            {fileObj.file ? `Size: ${(fileObj.file.size / 1024).toFixed(2)} KB` : 'Existing file'}
                          </div>
                        </div>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleRemoveFile(fileObj.id)}
                          title="Remove file"
                        >
                          🗑️
                        </Button>
                      </div>
                      
                      {/* Document Name Input */}
                      <Row className="mb-2">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="small fw-semibold">Document Name *</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="e.g., Balance Sheet, Income Statement"
                              value={fileObj.docName}
                              onChange={(e) => handleUpdateDocName(fileObj.id, e.target.value)}
                              size="sm"
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label className="small fw-semibold">Year *</Form.Label>
                            <Form.Control
                              type="number"
                              placeholder="2024"
                              value={fileObj.year}
                              onChange={(e) => handleUpdateYear(fileObj.id, e.target.value)}
                              min="1900"
                              max="2100"
                              size="sm"
                            />
                          </Form.Group>
                        </Col>
                      </Row>

                      {/* Preview section has been removed as requested */}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDocForm(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveDocument}
            disabled={docForm.files.length === 0 || docForm.files.some(file => !file.docName.trim() || !file.year.trim()) || isSaving}
          >
            {isSaving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              editingDocId ? 'Update Document' : `Save ${docForm.files.length} Document${docForm.files.length > 1 ? 's' : ''}`
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Document Modal */}
      <Modal show={showViewModal} onHide={handleCloseViewModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            👁️ View Document - {viewingDoc?.name || viewingDoc?.docName}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isLoadingDocument ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Loading...</span>
              </div>
              <div className="h5 text-muted">Loading document...</div>
              <div className="text-muted">Please wait while we prepare your document</div>
            </div>
          ) : viewingDoc && (
            <div>
              {/* Document Info */}
              <div className="mb-3 p-3 bg-light rounded">
                <Row>
                  <Col md={6}>
                    <strong>📄 Document Name:</strong> {viewingDoc.name || viewingDoc.docName}
                  </Col>
                  <Col md={6}>
                    <strong>📅 Year:</strong> {viewingDoc.year}
                  </Col>
                  <Col md={6} className="mt-2">
                    <strong>📎 File Name:</strong> {viewingDoc.fileName}
                  </Col>
                  <Col md={6} className="mt-2">
                    <strong>📅 Uploaded:</strong> {
                      viewingDoc.uploadedAt 
                        ? new Date(viewingDoc.uploadedAt).toLocaleDateString()
                        : viewingDoc.createdAt 
                          ? new Date(viewingDoc.createdAt.toDate()).toLocaleDateString()
                          : 'N/A'
                    }
                  </Col>
                </Row>
              </div>

              {/* Document Preview */}
              {(viewingDoc.fileData || viewingDoc.fileUrl) && (
                <div className="border p-3 rounded" style={{ maxHeight: '500px', overflow: 'auto', backgroundColor: '#f8f9fa' }}>
                  {(() => {
                    const fileType = viewingDoc.fileType || '';
                    
                    if (fileType.startsWith('image/') || viewingDoc.fileName?.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
                      return (
                        <div className="text-center">
                          <img 
                            src={viewingDoc.fileData || viewingDoc.fileUrl} 
                            alt={viewingDoc.fileName}
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '450px', 
                              objectFit: 'contain',
                              borderRadius: '5px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                          />
                        </div>
                      );
                    } else if (fileType.includes('pdf') || viewingDoc.fileName?.endsWith('.pdf')) {
                      return (
                        <div className="text-center">
                          <iframe 
                            src={viewingDoc.fileData || viewingDoc.fileUrl}
                            width="100%" 
                            height="450px"
                            style={{ 
                              border: 'none', 
                              borderRadius: '5px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                            title={viewingDoc.fileName}
                          />
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center p-4">
                          <div className="mb-3">
                            <div style={{ fontSize: '4rem', color: '#6c757d' }}>📄</div>
                          </div>
                          <div className="mb-2">
                            <strong>File:</strong> {viewingDoc.fileName}
                          </div>
                          <div className="small text-muted mb-3">
                            {fileType || 'Unknown file type'}
                          </div>
                          <div className="small text-warning">
                            <em>Preview not available for this file type</em>
                          </div>
                          {(viewingDoc.fileData || viewingDoc.fileUrl) && (
                            <div className="mt-3">
                              <Button 
                                variant="primary" 
                                size="sm"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = viewingDoc.fileData || viewingDoc.fileUrl;
                                  link.download = viewingDoc.fileName;
                                  link.click();
                                }}
                              >
                                📥 Download File
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
              
              {!viewingDoc.fileData && !viewingDoc.fileUrl && (
                <div className="text-center p-4 text-muted">
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📄</div>
                  <div>No file data available for preview</div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseViewModal}>
            Close
          </Button>
          {(viewingDoc?.fileData || viewingDoc?.fileUrl) && !isLoadingDocument && (
            <Button 
              variant="primary"
              onClick={() => {
                const link = document.createElement('a');
                link.href = viewingDoc.fileData || viewingDoc.fileUrl;
                link.download = viewingDoc.fileName;
                link.click();
              }}
            >
              📥 Download
            </Button>
          )}
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

export default DocumentManagement;