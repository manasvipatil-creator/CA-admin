import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Badge, Modal, Form, Row, Col, Toast, ToastContainer, Container, Alert } from 'react-bootstrap';
import { db, storage } from '../../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject, getStorage } from "firebase/storage";
import { doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { bannerHelpers, firestoreHelpers } from '../../utils/firestoreHelpers';
import { 
  FiImage, 
  FiCheckCircle, 
  FiPauseCircle, 
  FiPlus, 
  FiEye, 
  FiEdit, 
  FiTrash2,
  FiUpload
} from 'react-icons/fi';

const BannerManagement = () => {
  const { userEmail, getUserBannersRef, getUserPath } = useAuth();
  const [banners, setBanners] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [editingBanner, setEditingBanner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: "", variant: "" });
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingBanner, setViewingBanner] = useState(null);
  
  // Ref to track if component is mounted
  const mountedRef = React.useRef(true);
  // Unique identifier for this component instance
  const componentId = React.useRef(`banner-mgmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Form state
  const [bannerForm, setBannerForm] = useState({
    bannerName: "",
    bannerImage: null,
    imagePreview: ""
  });

  // Ensure mounted ref is set correctly
  useEffect(() => {
    mountedRef.current = true;
    console.log("🔧 Component mounted, mountedRef set to true");
    return () => {
      mountedRef.current = false;
      console.log("🔧 Component unmounting, mountedRef set to false");
    };
  }, []);

  // Load banners from Firestore (user-specific)
  useEffect(() => {
    // Early return if no user email
    if (!userEmail) {
      console.log("⚠️ No user email, skipping banner listener setup");
      setBanners([]);
      setInitialLoading(false);
      return;
    }

    const bannersRef = getUserBannersRef();
    if (!bannersRef) {
      console.log("⚠️ No banners reference, skipping banner listener setup");
      setBanners([]);
      setInitialLoading(false);
      return;
    }

    console.log("🔗 Setting up Firestore listener for banners (Component ID:", componentId.current, ")");
    console.log("📍 Banners collection path:", bannersRef.path);
    
    // Use direct firestoreHelpers.subscribe instead of bannerHelpers.subscribeToBanners
    // to avoid the enhanced callback wrapper that might be causing issues
    console.log("🔗 Setting up direct Firestore subscription...");
    const unsubscribe = firestoreHelpers.subscribe(
      bannersRef,
      (bannersList) => {
        console.log("🔧 mountedRef.current:", mountedRef.current);
        
        // Temporarily remove mounted check to debug the issue
        console.log("🎯 INITIAL LISTENER TRIGGERED! Banner data received:", bannersList);
        console.log("📊 Banner data length:", bannersList.length);
        console.log("🔄 Setting banners state...");
        setBanners(bannersList);
        console.log("🔄 Setting initialLoading to false...");
        setInitialLoading(false);
        console.log("✅ Initial state updated with", bannersList.length, "banners");
        
        // Force a re-render check
        setTimeout(() => {
          console.log("🔍 State check after timeout - banners:", bannersList.length, "initialLoading should be false");
        }, 100);
      },
      (error) => {
        if (!mountedRef.current) {
          console.log("⚠️ Component unmounted, skipping error state update");
          return;
        }
        console.error("❌ Initial Firestore listener error:", error);
        setBanners([]);
      }
    );

    return () => {
      console.log("🧹 Cleaning up Firestore listener for banners (Component ID:", componentId.current, ")");
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userEmail, getUserBannersRef]);

  // Show alert message
  const showAlert = (message, variant = "success") => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: "", variant: "" }), 3000);
  };



  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBannerForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showAlert("Please select a valid image file", "danger");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showAlert("Image size should be less than 5MB", "danger");
        return;
      }

      setBannerForm(prev => ({
        ...prev,
        bannerImage: file,
        imagePreview: URL.createObjectURL(file)
      }));
    }
  };

  // Reset form
  const resetForm = () => {
    // Clean up blob URL to prevent memory leaks
    if (bannerForm.imagePreview && bannerForm.imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(bannerForm.imagePreview);
    }
    
    setBannerForm({
      bannerName: "",
      bannerImage: null,
      imagePreview: ""
    });
    setEditingBanner(null);
    setShowForm(false);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log("🎨 Banner form submission started");
    console.log("📋 Form data:", {
      bannerName: bannerForm.bannerName,
      hasImage: !!bannerForm.bannerImage,
      isEditing: !!editingBanner
    });
    
    if (!bannerForm.bannerName.trim()) {
      showAlert("Please enter banner name", "danger");
      return;
    }

    // Check for duplicate banner names (only for new banners or name changes)
    const bannerKey = bannerForm.bannerName.trim()
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase(); // Convert to lowercase

    const existingBanner = banners.find(banner => banner.id === bannerKey);
    if (existingBanner && (!editingBanner || editingBanner.id !== bannerKey)) {
      showAlert("A banner with this name already exists. Please choose a different name.", "danger");
      return;
    }

    if (!editingBanner && !bannerForm.bannerImage) {
      showAlert("Please select a banner image", "danger");
      return;
    }

    setLoading(true);

    try {
      let imageUrl = editingBanner?.imageUrl || "";
      let imagePath = editingBanner?.imagePath || "";

      // Upload image if new image is selected
      if (bannerForm.bannerImage) {
        console.log("📁 Uploading image to Firebase Storage...");
        
        try {
          const storage = getStorage();
          const fileName = `${Date.now()}_${bannerForm.bannerImage.name}`;
          imagePath = `banners/${userEmail}/${fileName}`;
          const imageRef = storageRef(storage, imagePath);
          
          console.log("📤 Uploading to path:", imagePath);
          const snapshot = await uploadBytes(imageRef, bannerForm.bannerImage);
          console.log("✅ Upload successful, getting download URL...");
          
          imageUrl = await getDownloadURL(snapshot.ref);
          console.log("🔗 Download URL obtained:", imageUrl);
          
        } catch (uploadError) {
          console.error("❌ Image upload failed:", uploadError);
          showAlert(`Image upload failed: ${uploadError.message}`, "danger");
          setLoading(false);
          return;
        }
      }

      const bannerData = {
        bannerName: bannerForm.bannerName.trim(),
        imageUrl,
        imagePath,
        isActive: true, // Always set to active by default
        createdAt: editingBanner?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Additional metadata for file tracking
        fileName: bannerForm.bannerImage ? bannerForm.bannerImage.name : editingBanner?.fileName || "",
        fileSize: bannerForm.bannerImage ? bannerForm.bannerImage.size : editingBanner?.fileSize || 0,
        fileType: bannerForm.bannerImage ? bannerForm.bannerImage.type : editingBanner?.fileType || "",
        note: editingBanner?.note || ""
      };

      console.log("💾 Saving banner data:", bannerData);

      const bannersRef = getUserBannersRef();
      if (!bannersRef) {
        showAlert("User authentication required", "danger");
        return;
      }

      if (editingBanner && editingBanner.id !== bannerKey) {
        // If banner name changed, delete old entry and create new one
        console.log("✏️ Banner name changed, moving from:", editingBanner.id, "to:", bannerKey);
        const oldBannerRef = doc(bannersRef, editingBanner.id);
        await bannerHelpers.deleteBanner(oldBannerRef);
        await bannerHelpers.createBanner(bannersRef, bannerKey, bannerData);
        showAlert("Banner updated successfully!", "success");
        console.log("✅ Banner updated with new key:", bannerKey);
      } else if (editingBanner) {
        // Update existing banner with same name
        console.log("✏️ Updating banner with key:", bannerKey);
        const bannerRef = doc(bannersRef, bannerKey);
        await bannerHelpers.updateBanner(bannerRef, bannerData);
        showAlert("Banner updated successfully!", "success");
        console.log("✅ Banner updated successfully");
      } else {
        // Add new banner with name as key
        console.log("➕ Adding new banner with key:", bannerKey);
        console.log("📍 Saving to collection path:", bannersRef.path);
        console.log("💾 Banner data being saved:", JSON.stringify(bannerData, null, 2));
        await bannerHelpers.createBanner(bannersRef, bannerKey, bannerData);
        console.log("✅ Banner added with key:", bannerKey);
        console.log("🔄 Banner should now be visible in listener...");
        showAlert("Banner added successfully!", "success");
      }

      resetForm();
    } catch (error) {
      console.error("Error saving banner:", error);
      showAlert("Failed to save banner. Please try again.", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Handle view banner
  const handleView = (banner) => {
    setViewingBanner(banner);
    setShowViewModal(true);
  };

  // Handle edit banner
  const handleEdit = (banner) => {
    setBannerForm({
      bannerName: banner.bannerName,
      bannerImage: null,
      imagePreview: banner.imageUrl
    });
    setEditingBanner(banner);
    setShowForm(true);
  };

  // Handle delete banner
  const handleDelete = async (banner) => {
    if (window.confirm(`Are you sure you want to delete "${banner.bannerName}"?`)) {
      try {
        setLoading(true);

        // Delete image from Firebase Storage if it exists
        if (banner.imagePath) {
          try {
            console.log("🗑️ Deleting image from storage:", banner.imagePath);
            const storage = getStorage();
            const imageRef = storageRef(storage, banner.imagePath);
            await deleteObject(imageRef);
            console.log("✅ Image deleted from storage successfully");
          } catch (deleteError) {
            console.warn("⚠️ Failed to delete image from storage:", deleteError);
            // Continue with banner deletion even if image deletion fails
          }
        }

        // Delete banner from Firestore
        const bannersRef = getUserBannersRef();
        if (!bannersRef) {
          showAlert("User authentication required", "danger");
          return;
        }
        const bannerRef = doc(bannersRef, banner.id);
        await bannerHelpers.deleteBanner(bannerRef);
        showAlert("Banner deleted successfully!", "success");
      } catch (error) {
        console.error("Error deleting banner:", error);
        showAlert("Failed to delete banner. Please try again.", "danger");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Container fluid className="p-4">
      {/* Alert */}
      {alert.show && (
        <Alert variant={alert.variant} className="mb-3">
          {alert.message}
        </Alert>
      )}

      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1" style={{ 
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: '700'
              }}>
                <FiImage className="me-2" />
                Banner Management
              </h2>
              <p className="text-muted mb-0">Manage app banners and promotional content</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-2 fw-semibold"
              style={{ 
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(13, 110, 253, 0.2)',
                fontSize: '0.875rem'
              }}
            >
              {showForm ? (
                <>
                  <FiTrash2 className="me-2" size={16} />
                  Cancel
                </>
              ) : (
                <>
                  <FiPlus className="me-2" size={16} />
                  Add New Banner
                </>
              )}
            </Button>
          </div>
        </Col>
      </Row>

      {/* Enhanced Header Section */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px'
          }}>
            <Card.Body className="p-4">
              <Row className="align-items-center">
                <Col md={8}>
                  <div className="text-white">
                    <div className="d-flex align-items-center mb-2">
                      <FiImage size={32} className="me-3" />
                      <div>
                        <h3 className="mb-1 fw-bold">Banner Management</h3>
                        <p className="mb-0 opacity-75">Manage your app banners and promotional content</p>
                      </div>
                    </div>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="text-center text-white">
                    <div style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      borderRadius: '15px', 
                      padding: '20px',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                        <FiImage size={40} />
                      </div>
                      <h2 className="mb-1 fw-bold">{banners.length}</h2>
                      <p className="mb-0 opacity-90 small">Total Banners</p>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>


      {/* Banner Form */}
      {showForm && (
        <Row className="mb-4">
          <Col>
            <Card className="shadow-sm">
              <Card.Header className="bg-light">
                <h5 className="mb-0">
                  {editingBanner ? (
                    <>
                      <FiEdit className="me-2" size={18} />
                      Edit Banner
                    </>
                  ) : (
                    <>
                      <FiPlus className="me-2" size={18} />
                      Add New Banner
                    </>
                  )}
                </h5>
              </Card.Header>
              <Card.Body>
                <Form onSubmit={handleSubmit}>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Banner Name *</Form.Label>
                        <Form.Control
                          type="text"
                          name="bannerName"
                          value={bannerForm.bannerName}
                          onChange={handleInputChange}
                          placeholder="Enter banner name..."
                          required
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Banner Image *</Form.Label>
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          required={!editingBanner}
                        />
                        <Form.Text className="text-muted">
                          Supported formats: JPG, PNG, GIF. Max size: 5MB
                        </Form.Text>
                      </Form.Group>

                    </Col>

                    <Col md={6}>
                      {bannerForm.imagePreview && (
                        <div>
                          <Form.Label>Image Preview</Form.Label>
                          <div className="border rounded p-2">
                            <img
                              src={bannerForm.imagePreview}
                              alt="Banner preview"
                              style={{
                                width: '100%',
                                maxHeight: '200px',
                                objectFit: 'contain',
                                borderRadius: '4px'
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </Col>
                  </Row>

                  <div className="d-flex gap-2 mt-3">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading}
                    >
                      {loading ? '⏳ Saving...' : (editingBanner ? '💾 Update Banner' : '➕ Add Banner')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={resetForm}
                    >
                      🔄 Reset
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Banners Table */}
      <Row>
        <Col>
          <Card className="shadow-sm">
            <Card.Header className="bg-light d-flex justify-content-between align-items-center">
              <h5 className="mb-0">📋 All Banners</h5>
              <small className="text-muted">
                {banners.length} banner{banners.length !== 1 ? 's' : ''} found
              </small>
            </Card.Header>
            <Card.Body className="p-0">
              {initialLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <h5 className="text-muted">Loading banners...</h5>
                  <p className="text-muted">Please wait while we fetch your banners</p>
                </div>
              ) : banners.length === 0 ? (
                <div className="text-center py-5">
                  <div style={{ fontSize: '4rem', opacity: 0.3 }}>
                    <FiImage size={64} />
                  </div>
                  <h5 className="text-muted">No banners found</h5>
                  <p className="text-muted">Click "Add New Banner" to create your first banner</p>
                </div>
              ) : (
                <Table responsive hover className="mb-0">
                  <thead className="bg-light">
                    <tr>
                      <th>Sr. No</th>
                      <th>Banner Name</th>
                      <th>Image</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banners.map((banner, index) => (
                      <tr key={banner.id}>
                        <td>
                          <span className="badge bg-primary">{index + 1}</span>
                        </td>
                        <td>
                          <strong>{banner.bannerName}</strong>
                        </td>
                        <td>
                          {banner.imageUrl && banner.imageUrl.startsWith('blob:') ? (
                            <div style={{
                              width: '80px',
                              height: '50px',
                              backgroundColor: '#f8f9fa',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              color: '#6c757d'
                            }}>
                              📷 Preview
                            </div>
                          ) : banner.imageUrl ? (
                            <img
                              src={banner.imageUrl}
                              alt={banner.bannerName}
                              style={{
                                width: '80px',
                                height: '50px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                border: '1px solid #dee2e6'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '80px',
                              height: '50px',
                              backgroundColor: '#f8f9fa',
                              border: '1px solid #dee2e6',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              color: '#6c757d'
                            }}>
                              No Image
                            </div>
                          )}
                          <div style={{
                            display: 'none',
                            width: '80px',
                            height: '50px',
                            backgroundColor: '#f8f9fa',
                            border: '1px solid #dee2e6',
                            borderRadius: '4px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            color: '#6c757d'
                          }}>
                            Error Loading
                          </div>
                        </td>
                        <td>
                          <small className="text-muted">
                            {banner.createdAt ? 
                              new Date(banner.createdAt).toLocaleDateString('en-IN') : 
                              banner.createdAt && banner.createdAt.toDate ? 
                                banner.createdAt.toDate().toLocaleDateString('en-IN') : 
                                'N/A'
                            }
                          </small>
                        </td>
                        <td>
                          <div className="d-flex gap-1 justify-content-center align-items-center" style={{ minWidth: '140px' }}>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => handleView(banner)}
                              title="View banner"
                              className="px-2 py-1"
                              style={{ fontSize: '0.75rem', minWidth: '45px' }}
                            >
                              <FiEye size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-warning"
                              onClick={() => handleEdit(banner)}
                              title="Edit banner"
                              className="px-2 py-1"
                              style={{ fontSize: '0.75rem', minWidth: '45px' }}
                            >
                              <FiEdit size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleDelete(banner)}
                              title="Delete banner"
                              className="px-2 py-1"
                              style={{ fontSize: '0.75rem', minWidth: '45px' }}
                            >
                              <FiTrash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* View Banner Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FiEye className="me-2" size={18} />
            View Banner Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewingBanner && (
            <Row>
              <Col md={6}>
                <div className="mb-3">
                  <h6 className="text-muted mb-2">Banner Information</h6>
                  <Card className="border-0 bg-light">
                    <Card.Body>
                      <div className="mb-3">
                        <strong>📝 Banner Name:</strong>
                        <div className="mt-1">{viewingBanner.bannerName}</div>
                      </div>
                      

                      <div className="mb-3">
                        <strong>📅 Created:</strong>
                        <div className="mt-1">
                          {viewingBanner.createdAt ? 
                            new Date(viewingBanner.createdAt).toLocaleString('en-IN') : 
                            viewingBanner.createdAt && viewingBanner.createdAt.toDate ? 
                              viewingBanner.createdAt.toDate().toLocaleString('en-IN') : 
                              'N/A'
                          }
                        </div>
                      </div>

                      <div className="mb-3">
                        <strong>🔄 Last Updated:</strong>
                        <div className="mt-1">
                          {viewingBanner.updatedAt ? 
                            new Date(viewingBanner.updatedAt).toLocaleString('en-IN') : 
                            viewingBanner.updatedAt && viewingBanner.updatedAt.toDate ? 
                              viewingBanner.updatedAt.toDate().toLocaleString('en-IN') : 
                              'N/A'
                          }
                        </div>
                      </div>

                      {viewingBanner.fileName && (
                        <div className="mb-3">
                          <strong>📎 File Name:</strong>
                          <div className="mt-1">{viewingBanner.fileName}</div>
                        </div>
                      )}

                      {viewingBanner.fileSize && viewingBanner.fileSize > 0 && (
                        <div className="mb-3">
                          <strong>📏 File Size:</strong>
                          <div className="mt-1">{(viewingBanner.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                      )}

                      {viewingBanner.fileType && (
                        <div className="mb-3">
                          <strong>🎨 File Type:</strong>
                          <div className="mt-1">{viewingBanner.fileType}</div>
                        </div>
                      )}

                      {viewingBanner.note && (
                        <div className="mb-0">
                          <strong>📝 Note:</strong>
                          <div className="mt-1 text-muted small">{viewingBanner.note}</div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              </Col>
              
              <Col md={6}>
                <div className="mb-3">
                  <h6 className="text-muted mb-2">Banner Preview</h6>
                  <Card className="border-0 bg-light">
                    <Card.Body className="text-center">
                      {viewingBanner.imageUrl ? (
                        <div>
                          <img
                            src={viewingBanner.imageUrl}
                            alt={viewingBanner.bannerName}
                            style={{
                              width: '100%',
                              maxHeight: '300px',
                              objectFit: 'contain',
                              borderRadius: '8px',
                              border: '1px solid #dee2e6',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}
                          />
                          <div className="mt-3">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => window.open(viewingBanner.imageUrl, '_blank')}
                            >
                              🔍 View Full Size
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div style={{ fontSize: '3rem', opacity: 0.3 }}>🖼️</div>
                          <p className="text-muted">No image available</p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowViewModal(false)}>
            ❌ Close
          </Button>
          {viewingBanner && (
            <>
              <Button 
                variant="warning" 
                onClick={() => {
                  setShowViewModal(false);
                  handleEdit(viewingBanner);
                }}
              >
                ✏️ Edit Banner
              </Button>
              {viewingBanner.imageUrl && (
                <Button
                  variant="primary"
                  onClick={() => window.open(viewingBanner.imageUrl, '_blank')}
                >
                  🔍 Open Full Image
                </Button>
              )}
            </>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default BannerManagement;
