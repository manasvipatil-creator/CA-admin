import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Badge, Modal, Form, Row, Col, Alert } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { notificationHelpers } from '../../utils/firestoreHelpers';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

const NotificationManagement = () => {
  const { getUserNotificationsRef, getNotificationDocRef, userEmail, authenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    image: null,
    priority: 'medium'
  });
  const [editingNotification, setEditingNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [error, setError] = useState('');

  // Load notifications on component mount
  useEffect(() => {
    if (authenticated && userEmail) {
      loadNotifications();
      
      // Set up real-time subscription
      const notificationsRef = getUserNotificationsRef();
      
      if (notificationsRef) {
        const unsubscribe = notificationHelpers.subscribeToNotifications(
          notificationsRef,
          (notificationsList) => {
            setNotifications(notificationsList);
            setNotificationsLoading(false);
          },
          (error) => {
            console.error('Error subscribing to notifications:', error);
            setError('Failed to load notifications');
            setNotificationsLoading(false);
          }
        );

        return () => unsubscribe();
      } else {
        setNotificationsLoading(false);
      }
    } else {
      setNotificationsLoading(false);
    }
  }, [authenticated, userEmail]);

  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const notificationsRef = getUserNotificationsRef();
      
      if (notificationsRef) {
        const notificationsList = await notificationHelpers.getNotifications(notificationsRef);
        setNotifications(notificationsList);
      } else {
        setError('User not authenticated');
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleAddNotification = () => {
    setFormData({
      title: '',
      message: '',
      image: null,
      priority: 'medium'
    });
    setShowAddModal(true);
  };

  const handleEditNotification = (notification) => {
    setEditingNotification(notification);
    setFormData({
      title: notification.title,
      message: notification.message,
      image: null,
      priority: notification.priority
    });
    setShowEditModal(true);
  };

  const handleDeleteNotification = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) {
      return;
    }

    try {
      setLoading(true);
      const notificationDocRef = getNotificationDocRef(id);
      if (notificationDocRef) {
        await notificationHelpers.deleteNotification(notificationDocRef);
        setError('');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      setError('Failed to delete notification');
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (imageFile) => {
    if (!imageFile) return null;

    try {
      const timestamp = Date.now();
      const fileName = `notification_${timestamp}_${imageFile.name}`;
      const storageRef = ref(storage, `notifications/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, imageFile);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return {
        imageUrl: downloadURL,
        imagePath: snapshot.ref.fullPath,
        fileName: imageFile.name,
        fileSize: imageFile.size,
        fileType: imageFile.type
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      setError('Title and message are required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let imageData = null;
      if (formData.image) {
        imageData = await uploadImage(formData.image);
      }

      const notificationData = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        priority: formData.priority,
        ...imageData
      };

      const notificationsRef = getUserNotificationsRef();
      
      if (editingNotification) {
        // Update existing notification
        const notificationDocRef = getNotificationDocRef(editingNotification.id);
        
        if (notificationDocRef) {
          await notificationHelpers.updateNotification(notificationDocRef, notificationData);
        }
        setShowEditModal(false);
      } else {
        // Create new notification
        if (notificationsRef) {
          await notificationHelpers.createNotification(notificationsRef, notificationData);
        } else {
          setError('User not authenticated - cannot create notification');
          return;
        }
        setShowAddModal(false);
      }

      // Reset form
      setFormData({
        title: '',
        message: '',
        image: null,
        priority: 'medium'
      });
      setEditingNotification(null);
    } catch (error) {
      console.error('❌ Error saving notification:', error);
      setError('Failed to save notification: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority) => {
    const variants = {
      high: 'danger',
      medium: 'warning',
      low: 'info'
    };
    return <Badge bg={variants[priority]}>{priority.toUpperCase()}</Badge>;
  };


  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Handle Firestore timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      <h3 className="mb-3">🔔 Notification Management</h3>
      
      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {/* Instructions */}
      <div className="alert alert-info mb-3" style={{ 
        borderRadius: '12px', 
        border: 'none', 
        background: 'linear-gradient(45deg, #e3f2fd, #f3e5f5)' 
      }}>
        <div className="d-flex align-items-center">
          <div style={{ fontSize: '1.5rem', marginRight: '12px' }}>💡</div>
          <div>
            <strong>Manage Notifications:</strong> Create, edit, and manage system notifications with title, message, and images.
          </div>
        </div>
      </div>

      {/* Section Header */}
      <Card className="mb-3">
        <Card.Body className="py-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0">Notifications</h5>
              <small className="text-muted">Manage system notifications and announcements</small>
            </div>
            <div className="d-flex gap-2">
              <Button variant="success" onClick={handleAddNotification}>
                ➕ Add New Notification
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Notifications Table */}
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
                📋 Title
              </th>
              <th style={{ 
                padding: '16px 20px', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                border: 'none',
                letterSpacing: '0.5px'
              }}>
                💬 Message
              </th>
              <th style={{ 
                padding: '16px 20px', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                border: 'none',
                letterSpacing: '0.5px',
                textAlign: 'center'
              }}>
                🖼️ Image
              </th>
              <th style={{ 
                padding: '16px 20px', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                border: 'none',
                letterSpacing: '0.5px',
                textAlign: 'center'
              }}>
                🎯 Priority
              </th>
              <th style={{ 
                padding: '16px 20px', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                border: 'none',
                letterSpacing: '0.5px',
                textAlign: 'center'
              }}>
                📅 Created
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
            {notifications.map((notification, index) => (
              <tr key={notification.id} style={{
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
                  border: 'none',
                  borderBottom: '1px solid #e9ecef'
                }}>
                  <div className="fw-bold text-primary">{notification.title}</div>
                </td>
                <td style={{ 
                  padding: '16px 20px', 
                  border: 'none',
                  borderBottom: '1px solid #e9ecef',
                  maxWidth: '300px'
                }}>
                  <div className="text-truncate" title={notification.message}>
                    {notification.message}
                  </div>
                </td>
                <td style={{ 
                  padding: '16px 20px', 
                  textAlign: 'center',
                  border: 'none',
                  borderBottom: '1px solid #e9ecef'
                }}>
                  {notification.imageUrl ? (
                    <Badge bg="info">📷 {notification.fileName || 'Image'}</Badge>
                  ) : (
                    <Badge bg="secondary">No Image</Badge>
                  )}
                </td>
                <td style={{ 
                  padding: '16px 20px', 
                  textAlign: 'center',
                  border: 'none',
                  borderBottom: '1px solid #e9ecef'
                }}>
                  {getPriorityBadge(notification.priority)}
                </td>
                <td style={{ 
                  padding: '16px 20px', 
                  textAlign: 'center',
                  border: 'none',
                  borderBottom: '1px solid #e9ecef'
                }}>
                  <small className="text-muted">
                    {formatDate(notification.createdAt)}
                  </small>
                </td>
                <td style={{ 
                  padding: '16px 20px', 
                  textAlign: 'center',
                  border: 'none',
                  borderBottom: '1px solid #e9ecef'
                }}>
                  <div className="d-flex gap-2 justify-content-center">
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => handleEditNotification(notification)}
                      title="Edit notification"
                      style={{
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontWeight: '500',
                        border: 'none',
                        background: 'linear-gradient(45deg, #ffc107, #e0a800)',
                        boxShadow: '0 2px 6px rgba(255,193,7,0.3)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteNotification(notification.id)}
                      title="Delete notification"
                      style={{
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontWeight: '500',
                        border: 'none',
                        background: 'linear-gradient(45deg, #dc3545, #c82333)',
                        boxShadow: '0 2px 6px rgba(220,53,69,0.3)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {notifications.length === 0 && !notificationsLoading && (
              <tr>
                <td colSpan="6" style={{ 
                  padding: '40px 20px', 
                  textAlign: 'center',
                  color: '#6c757d',
                  fontSize: '1.1rem',
                  border: 'none'
                }}>
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔔</div>
                    <div style={{ fontWeight: '500', marginBottom: '8px' }}>No notifications found</div>
                    <div style={{ fontSize: '0.9rem', color: '#adb5bd' }}>Click "Add New Notification" to get started</div>
                  </div>
                </td>
              </tr>
            )}
            {notificationsLoading && (
              <tr>
                <td colSpan="6" style={{ 
                  padding: '40px 20px', 
                  textAlign: 'center',
                  color: '#6c757d',
                  fontSize: '1.1rem',
                  border: 'none'
                }}>
                  <div>
                    <div className="spinner-border text-primary mb-3" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div>Loading notifications...</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Add Notification Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>🔔 Add New Notification</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>📋 Title *</strong>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter notification title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>💬 Message *</strong>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    placeholder="Enter notification message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>🖼️ Image</strong>
                  </Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData({ ...formData, image: e.target.files[0] })}
                  />
                  <Form.Text className="text-muted">
                    Upload an image for the notification (optional)
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>🎯 Priority</strong>
                  </Form.Label>
                  <Form.Select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSubmit}
            disabled={!formData.title || !formData.message || loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Adding...
              </>
            ) : (
              '➕ Add Notification'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Notification Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>✏️ Edit Notification</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>📋 Title *</strong>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter notification title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>💬 Message *</strong>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    placeholder="Enter notification message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>🖼️ Image</strong>
                  </Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData({ ...formData, image: e.target.files[0] })}
                  />
                  <Form.Text className="text-muted">
                    Upload a new image to replace the current one (optional)
                  </Form.Text>
                  {editingNotification?.fileName && (
                    <div className="mt-2">
                      <small className="text-info">Current: {editingNotification.fileName}</small>
                    </div>
                  )}
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>🎯 Priority</strong>
                  </Form.Label>
                  <Form.Select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="warning" 
            onClick={handleSubmit}
            disabled={!formData.title || !formData.message || loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Updating...
              </>
            ) : (
              '✏️ Update Notification'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default NotificationManagement;
