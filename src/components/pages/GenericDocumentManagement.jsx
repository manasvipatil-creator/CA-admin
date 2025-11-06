import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Table, Badge, Modal, Form, Row, Col, Toast, ToastContainer } from 'react-bootstrap';
import { db, storage, rtdb } from '../../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { ref as rtdbRef, set, onValue, remove } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import { firestoreHelpers, yearsHelpers } from '../../utils/firestoreHelpers';
import { collection, doc } from 'firebase/firestore';

const GenericDocumentManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { client } = location.state || {};
  const { getClientDocRef, getSafeEmail, userEmail, getUserClientPath } = useAuth();

  // Check if client exists, if not redirect back
  useEffect(() => {
    if (!client) {
      console.error("❌ No client data found, redirecting to client management");
      navigate('/admin/clients');
      return;
    }
  }, [client, navigate]);
  
  const [documents, setDocuments] = useState([]);
  const [showDocForm, setShowDocForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [editingDocId, setEditingDocId] = useState(null);
  const [selectedYear, setSelectedYear] = useState('generic'); // Default year for generic documents
  const [docForm, setDocForm] = useState({
    files: [], // Array of file objects: {file, fileName, docName, localPreviewUrl}
  });
  
  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  
  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  
  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);

  // Load generic documents from Firebase RTDB
  useEffect(() => {
    if (!client) return;

    const loadGenericDocuments = () => {
      try {
        setIsLoadingDocuments(true);
        const clientContact = client.contact || client.id;
        const userClientPath = getUserClientPath();
        
        if (!userClientPath) {
          console.error("❌ Unable to get user client path");
          setIsLoadingDocuments(false);
          return;
        }

        // Subscribe to real-time updates from Firebase RTDB
        // Path now includes years subcollection: userClientPath/clientContact/years/generic/genericDocuments
        const genericDocsRef = rtdbRef(rtdb, `${userClientPath}/${clientContact}/years/${selectedYear}/genericDocuments`);
        
        const unsubscribe = onValue(genericDocsRef, (snapshot) => {
          if (snapshot.exists()) {
            const docsData = snapshot.val();
            // Convert object to array
            const docsArray = Object.entries(docsData).map(([id, doc]) => ({
              id,
              ...doc
            }));
            setDocuments(docsArray);
            console.log("📂 Loaded generic documents from RTDB:", docsArray.length);
          } else {
            setDocuments([]);
            console.log("📂 No generic documents found in RTDB");
          }
          setIsLoadingDocuments(false);
        }, (error) => {
          console.error("❌ Error loading generic documents from RTDB:", error);
          setDocuments([]);
          setIsLoadingDocuments(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("❌ Error setting up generic documents listener:", error);
        setIsLoadingDocuments(false);
      }
    };

    loadGenericDocuments();
  }, [client, getUserClientPath]);

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
    navigate('/admin/clients');
  };

  const handleAddDocument = () => {
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
    
    setTimeout(() => {
      setIsLoadingDocument(false);
    }, 500);
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
        localPreviewUrl: doc.fileUrl || "", // Use fileUrl for existing documents
        existingDoc: true
      }],
    });
    setEditingDocId(doc.id);
    setShowDocForm(true);
  };

  const handleDeleteDocument = async (document) => {
    const confirmMessage = `⚠️ Are you sure you want to delete "${document.name || document.docName}"?\n\nThis action cannot be undone.`;
    if (window.confirm(confirmMessage)) {
      try {
        console.log("🗑️ Deleting generic document:", document.id);
        
        const clientContact = client.contact || client.id;
        const userClientPath = getUserClientPath();
        
        if (!userClientPath) {
          throw new Error("Unable to get user client path");
        }

        // Delete from Firebase RTDB (now under years subcollection)
        const docRef = rtdbRef(rtdb, `${userClientPath}/${clientContact}/years/${selectedYear}/genericDocuments/${document.id}`);
        await remove(docRef);
        console.log("🗑️ Deleted from Firebase RTDB");
        
        // Also delete from Firestore - genericDocuments as subcollection parallel to years
        const clientDocRef = getClientDocRef(clientContact);
        if (clientDocRef) {
          const genericDocsCollectionRef = collection(clientDocRef, 'genericDocuments');
          const docToDeleteRef = doc(genericDocsCollectionRef, document.id);
          await firestoreHelpers.delete(docToDeleteRef);
          console.log("🗑️ Deleted from Firestore genericDocuments subcollection");
        }

        // Delete file from storage if it exists
        if (document.fileUrl) {
          try {
            const fileRef = storageRef(storage, document.fileUrl);
            await deleteObject(fileRef);
            console.log("🗑️ Deleted file from storage");
          } catch (storageError) {
            console.warn("⚠️ Could not delete file from storage:", storageError);
          }
        }

        showSuccessToast(`Document "${document.name || document.docName}" deleted successfully!`);
        console.log("✅ Generic document deleted successfully");
      } catch (error) {
        console.error("❌ Error deleting generic document:", error);
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
    const fileToRemove = docForm.files.find(file => file.id === fileId);
    if (fileToRemove && fileToRemove.localPreviewUrl) {
      URL.revokeObjectURL(fileToRemove.localPreviewUrl);
    }
    
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

  const handleSaveDocument = async () => {
    if (docForm.files.length === 0) {
      showErrorToast("Please select at least one file");
      return;
    }

    // Check if all files have document names
    const filesWithoutNames = docForm.files.filter(file => !file.docName.trim());
    if (filesWithoutNames.length > 0) {
      showErrorToast("Please provide document names for all files");
      return;
    }

    setIsSaving(true);
    try {
      const clientContact = client.contact || client.id;
      const userClientPath = getUserClientPath();
      
      if (!userClientPath) {
        throw new Error("Unable to get user client path");
      }

      const safeEmail = getSafeEmail(userEmail);
      let successCount = 0;
      let errorCount = 0;

      // Process each file
      for (const fileObj of docForm.files) {
        try {
          // Skip if it's an existing document being edited without a new file
          if (editingDocId && !fileObj.file) {
            // Update existing document metadata only
            const docId = editingDocId;
            const updatedDoc = {
              name: fileObj.docName,
              docName: fileObj.docName,
              updatedAt: new Date().toISOString(),
            };

            // Update in Firebase RTDB
            const docRef = rtdbRef(rtdb, `${userClientPath}/${clientContact}/years/${selectedYear}/genericDocuments/${docId}`);
            await set(docRef, updatedDoc);
            
            // Update in Firestore
            const clientDocRef = getClientDocRef(clientContact);
            if (clientDocRef) {
              const genericDocsCollectionRef = collection(clientDocRef, 'genericDocuments');
              const docRefFirestore = doc(genericDocsCollectionRef, docId);
              await firestoreHelpers.update(docRefFirestore, updatedDoc);
            }
            
            successCount++;
            continue;
          }

          if (!fileObj.file) continue;

          // Upload file to Firebase Storage
          const timestamp = Date.now();
          const randomSuffix = Math.floor(Math.random() * 10000);
          const fileName = `${safeEmail}/clients/${clientContact}/generic/${timestamp}_${randomSuffix}_${fileObj.file.name}`;
          const fileRef = storageRef(storage, fileName);
          
          console.log("📤 Uploading file to storage:", fileName);
          await uploadBytes(fileRef, fileObj.file);
          const fileUrl = await getDownloadURL(fileRef);
          console.log("✅ File uploaded successfully");

          const docId = editingDocId || `generic_${timestamp}_${randomSuffix}`;
          const newDoc = {
            name: fileObj.docName,
            docName: fileObj.docName,
            fileName: fileObj.fileName,
            fileUrl: fileUrl,
            fileSize: fileObj.file.size,
            uploadedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Save to Firebase RTDB
          const docRef = rtdbRef(rtdb, `${userClientPath}/${clientContact}/years/${selectedYear}/genericDocuments/${docId}`);
          await set(docRef, newDoc);
          console.log("✅ Saved to Firebase RTDB");
          
          // Save to Firestore
          const clientDocRef = getClientDocRef(clientContact);
          if (clientDocRef) {
            const genericDocsCollectionRef = collection(clientDocRef, 'genericDocuments');
            const docRefFirestore = doc(genericDocsCollectionRef, docId);
            
            await firestoreHelpers.set(docRefFirestore, newDoc);
            console.log("✅ Saved to Firestore genericDocuments subcollection");
          }

          successCount++;
        } catch (fileError) {
          console.error(`❌ Error saving file ${fileObj.fileName}:`, fileError);
          errorCount++;
        }
      }

      // Clean up local preview URLs
      docForm.files.forEach(fileObj => {
        if (fileObj.localPreviewUrl && fileObj.file) {
          URL.revokeObjectURL(fileObj.localPreviewUrl);
        }
      });

      // Show appropriate success/error message
      if (successCount > 0 && errorCount === 0) {
        if (editingDocId) {
          showSuccessToast(`Document updated successfully!`);
        } else {
          showSuccessToast(`${successCount} document${successCount > 1 ? 's' : ''} added successfully!`);
        }
      } else if (successCount > 0 && errorCount > 0) {
        showSuccessToast(`${successCount} document${successCount > 1 ? 's' : ''} saved successfully. ${errorCount} failed.`);
      } else {
        showErrorToast("Failed to save documents. Please try again.");
      }

      console.log("✅ Generic document operation completed");
      setShowDocForm(false);
      setDocForm({
        files: [],
      });
      setEditingDocId(null);
    } catch (error) {
      console.error("❌ Error saving generic documents:", error);
      showErrorToast(`Failed to save documents: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Clean up local URLs when component unmounts or modal closes
  useEffect(() => {
    return () => {
      // Clean up local preview URLs when component unmounts
      if (docForm.files && docForm.files.length > 0) {
        docForm.files.forEach(fileObj => {
          if (fileObj.localPreviewUrl && fileObj.file) {
            URL.revokeObjectURL(fileObj.localPreviewUrl);
          }
        });
      }
    };
  }, []);

  const handleCloseDocForm = () => {
    // Clean up local preview URLs when modal closes
    if (docForm.files && docForm.files.length > 0) {
      docForm.files.forEach(fileObj => {
        if (fileObj.localPreviewUrl && fileObj.file) {
          URL.revokeObjectURL(fileObj.localPreviewUrl);
        }
      });
    }
    setShowDocForm(false);
  };

  return (
    <div>
      <h3 className="mb-3">📂 Generic Document Management - {client?.name}</h3>
      
      {/* Client Info Card */}
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

      {/* Section Header */}
      <Card className="mb-3">
        <Card.Body className="py-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0">Generic Documents</h5>
              <small className="text-muted">Documents without specific year association</small>
            </div>
            <div className="d-flex gap-2">
              <Button variant="success" onClick={handleAddDocument}>
                ➕ Add Generic Document
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Documents Table */}
      <div className="table-responsive shadow-sm rounded">
        <Table hover className="mb-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          <thead style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <tr>
              <th style={{ padding: '16px 20px', fontWeight: '600', fontSize: '0.95rem', border: 'none' }}>
                📄 Document Name
              </th>
              <th style={{ padding: '16px 20px', fontWeight: '600', fontSize: '0.95rem', border: 'none', textAlign: 'center' }}>
                📅 Uploaded Date
              </th>
              <th style={{ padding: '16px 20px', fontWeight: '600', fontSize: '0.95rem', border: 'none', textAlign: 'center' }}>
                ⚡ Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoadingDocuments ? (
              <tr>
                <td colSpan="3" style={{ padding: '60px 20px', textAlign: 'center', border: 'none' }}>
                  <div className="d-flex flex-column align-items-center">
                    <div className="spinner-border text-primary mb-3" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div className="h5 text-muted mb-2">Loading documents...</div>
                  </div>
                </td>
              </tr>
            ) : documents.length > 0 ? (
              documents.map((doc, index) => (
                <tr key={doc.id || index} style={{
                  backgroundColor: index % 2 === 0 ? '#f8f9ff' : 'white',
                  transition: 'all 0.3s ease',
                }}>
                  <td style={{ padding: '16px 20px', border: 'none', borderBottom: '1px solid #e9ecef' }}>
                    <strong>{doc.name || doc.docName}</strong>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center', border: 'none', borderBottom: '1px solid #e9ecef' }}>
                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center', border: 'none', borderBottom: '1px solid #e9ecef' }}>
                    <div className="d-flex gap-2 justify-content-center">
                      <Button
                        variant="info"
                        size="sm"
                        onClick={() => handleViewDocument(doc)}
                        style={{ borderRadius: '8px', padding: '6px 12px' }}
                      >
                        👁️ View
                      </Button>
                      <Button
                        variant="warning"
                        size="sm"
                        onClick={() => handleEditDocument(doc)}
                        style={{ borderRadius: '8px', padding: '6px 12px' }}
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteDocument(doc)}
                        style={{ borderRadius: '8px', padding: '6px 12px' }}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" style={{ padding: '40px 20px', textAlign: 'center', border: 'none' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📂</div>
                  <div style={{ fontWeight: '500', marginBottom: '8px' }}>No generic documents found</div>
                  <div style={{ fontSize: '0.9rem', color: '#adb5bd' }}>Click "Add Generic Document" to get started</div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Add/Edit Document Modal */}
      <Modal show={showDocForm} onHide={handleCloseDocForm} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingDocId ? '✏️ Edit' : '➕ Add'} Generic Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            
            <Form.Group className="mb-3">
              <Form.Label><strong>Upload File *</strong></Form.Label>
              
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
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
                <i className="bi bi-info-circle"></i> Supported formats: PDF, JPG, PNG, DOC, DOCX
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
                      <Form.Group className="mb-2">
                        <Form.Label className="small fw-semibold">Document Name *</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="e.g., PAN Card, Aadhar Card, Registration Certificate"
                          value={fileObj.docName}
                          onChange={(e) => handleUpdateDocName(fileObj.id, e.target.value)}
                          size="sm"
                        />
                      </Form.Group>

                      {/* Preview section has been removed as requested */}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDocForm}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveDocument}
            disabled={docForm.files.length === 0 || docForm.files.some(file => !file.docName.trim()) || isSaving}
          >
            {isSaving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              editingDocId ? '✏️ Update Document' : `➕ Add ${docForm.files.length} Document${docForm.files.length > 1 ? 's' : ''}`
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Document Modal */}
      <Modal show={showViewModal} onHide={handleCloseViewModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>👁️ View Document - {viewingDoc?.name || viewingDoc?.docName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isLoadingDocument ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Loading...</span>
              </div>
              <div className="h5 text-muted">Loading document...</div>
            </div>
          ) : viewingDoc ? (
            <div>
              <div className="mb-3">
                <strong>File Name:</strong> {viewingDoc.fileName}
              </div>
              {viewingDoc.fileUrl && (
                <div className="text-center">
                  {viewingDoc.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? (
                    <img 
                      src={viewingDoc.fileUrl} 
                      alt={viewingDoc.name} 
                      style={{ maxWidth: '100%', maxHeight: '500px' }} 
                      onError={(e) => {
                        console.log('Image failed to load, showing download option');
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : viewingDoc.fileName?.toLowerCase().match(/\.pdf$/) ? (
                    <iframe 
                      src={viewingDoc.fileUrl} 
                      style={{ width: '100%', height: '500px', border: 'none' }} 
                      title="PDF Preview" 
                    />
                  ) : (
                    <div className="p-5">
                      <div style={{ fontSize: '4rem' }}>📄</div>
                      <div className="mt-3">
                        <a href={viewingDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                          📥 Download Document
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-5">
              <div style={{ fontSize: '3rem' }}>❌</div>
              <div className="mt-3">Document not found</div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseViewModal}>
            Close
          </Button>
          {viewingDoc?.fileUrl && (
            <Button 
              variant="primary" 
              href={viewingDoc.fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
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

export default GenericDocumentManagement;