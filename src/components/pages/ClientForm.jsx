import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { clientHelpers } from '../../utils/firestoreHelpers';

const ClientForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userEmail, getUserClientsRef, getClientDocRef, getSafeEmail } = useAuth();
  const { client, editIndex } = location.state || { client: null, editIndex: null };
  
  const [formData, setFormData] = useState({ name: "", contact: "", pan: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  // 🔹 Safe key for RTDB using name only
  const makeNameKey = (name) =>
    String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[.#$\[\]/]/g, "")
      .replace(/\s+/g, "_");

  // Validation functions
  const validateField = (name, value) => {
    const errors = {};
    
    switch (name) {
      case 'name':
        if (!value || value.trim().length === 0) {
          errors.name = 'Client name is required';
        } else if (value.trim().length < 2) {
          errors.name = 'Client name must be at least 2 characters';
        } else if (value.trim().length > 100) {
          errors.name = 'Client name must be less than 100 characters';
        } else if (!/^[a-zA-Z\s.'-]+$/.test(value.trim())) {
          errors.name = 'Client name can only contain letters, spaces, dots, apostrophes, and hyphens';
        }
        break;
        
      case 'contact':
        if (!value || value.trim().length === 0) {
          errors.contact = 'Contact number is required';
        } else {
          // Remove all non-digits for validation
          const digitsOnly = value.replace(/\D/g, '');
          if (digitsOnly.length !== 10) {
            errors.contact = 'Contact number must be exactly 10 digits';
          } else if (!/^[6-9]\d{9}$/.test(digitsOnly)) {
            errors.contact = 'Contact number must start with 6, 7, 8, or 9 and be exactly 10 digits';
          }
        }
        break;
        
      case 'pan':
        if (!value || value.trim().length === 0) {
          errors.pan = 'PAN number is required';
        } else {
          const sanitizedPAN = value.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
          const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
          if (!panRegex.test(sanitizedPAN)) {
            errors.pan = 'PAN must be in format: ABCDE1234F (5 letters, 4 digits, 1 letter)';
          }
        }
        break;
        
      case 'email':
        if (!value || value.trim().length === 0) {
          errors.email = 'Email address is required';
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value.trim())) {
            errors.email = 'Please enter a valid email address';
          } else if (value.trim().length > 254) {
            errors.email = 'Email address is too long';
          }
        }
        break;
        
      default:
        break;
    }
    
    return errors;
  };

  const validateAllFields = () => {
    const allErrors = {};
    Object.keys(formData).forEach(field => {
      const fieldError = validateField(field, formData[field]);
      Object.assign(allErrors, fieldError);
    });
    return allErrors;
  };

  const handleFieldChange = (name, value) => {
    // Update form data
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Validate field in real-time if it's been touched
    if (touched[name] || value.length > 0) {
      const fieldError = validateField(name, value);
      setFieldErrors(prev => ({
        ...prev,
        ...fieldError,
        // Clear error if field is now valid
        ...(Object.keys(fieldError).length === 0 ? { [name]: undefined } : {})
      }));
    }
  };

  const handleFieldBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const fieldError = validateField(name, formData[name]);
    setFieldErrors(prev => ({
      ...prev,
      ...fieldError,
      // Clear error if field is now valid
      ...(Object.keys(fieldError).length === 0 ? { [name]: undefined } : {})
    }));
  };

  useEffect(() => {
    if (client) {
      setFormData(client);
    } else {
      // Reset form data when no client is provided (add mode)
      setFormData({ name: "", contact: "", pan: "", email: "" });
    }
  }, [client]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate all fields
    const validationErrors = validateAllFields();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Please fix the validation errors below before submitting.");
      setLoading(false);
      return;
    }

    if (!userEmail) {
      setError("Please ensure you are logged in.");
      setLoading(false);
      return;
    }

    // Get sanitized PAN for document ID
    const sanitizedPAN = formData.pan.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const clientsRef = getUserClientsRef();
    if (!clientsRef) {
      setError("Unable to determine user path. Please try logging in again.");
      setLoading(false);
      return;
    }

    try {
      console.log("💾 Saving client to Firestore:", formData.name);

      if (editIndex !== null && editIndex !== undefined) {
        // Update existing client in Firestore
        const clientDocRef = getClientDocRef(editIndex);
        await clientHelpers.updateClient(clientDocRef, {
          ...formData,
          pan: sanitizedPAN, // Use sanitized PAN
          years: formData.years || []
        });
        console.log("✏️ Client updated in Firestore:", editIndex);
      } else {
        // Add new client to Firestore (PAN will be used as document ID)
        const firmId = getSafeEmail(userEmail);
        if (!firmId) {
          setError("Could not determine Firm ID. Please ensure you are logged in correctly.");
          setLoading(false);
          return;
        }
        await clientHelpers.createClient(clientsRef, {
          ...formData,
          firmId, // Add firmId
          pan: sanitizedPAN // Use sanitized PAN
        });
        console.log("➕ New client added to Firestore with PAN ID:", sanitizedPAN);
      }
      
      // Navigate back to client management
      navigate('/admin/clients', { 
        state: { 
          message: editIndex !== null ? 'Client updated successfully!' : 'Client added successfully!',
          type: 'success'
        }
      });
    } catch (error) {
      console.error("Error saving client:", error);
      setError("Failed to save client. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/clients');
  };

  return (
    <div>
      <h3 className="mb-3">{editIndex !== null ? '✏️ Edit Client' : '➕ Add New Client'}</h3>
      
      {/* Back Navigation Card - Same as other pages */}
      <Card className="mb-2 shadow-sm">
        <Card.Body className="py-2">
          <div className="d-flex justify-content-between align-items-center">
            <div className="small text-muted">
              <strong>Action:</strong> {editIndex !== null ? 'Editing existing client' : 'Adding new client'}
            </div>
            <Button variant="outline-info" size="sm" onClick={handleCancel}>
              ← Back to Client Management
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Form Card - Same structure as other pages */}
      <Card className="shadow-sm">
        <Card.Body>
              {error && (
                <Alert variant="danger" className="mb-3">
                  {error}
                </Alert>
              )}
              
              {Object.keys(fieldErrors).some(key => fieldErrors[key]) && (
                <Alert variant="warning" className="mb-3">
                  <Alert.Heading className="h6">⚠️ Please fix the following errors:</Alert.Heading>
                  <ul className="mb-0 small">
                    {Object.keys(fieldErrors).map(key => 
                      fieldErrors[key] ? (
                        <li key={key}>
                          <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {fieldErrors[key]}
                        </li>
                      ) : null
                    )}
                  </ul>
                </Alert>
              )}
              
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <strong>👤 Client Name *</strong>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter client name"
                        value={formData.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        onBlur={() => handleFieldBlur('name')}
                        isInvalid={!!fieldErrors.name}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.name}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <strong>📞 Contact *</strong>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter 10-digit mobile number (e.g., 9876543210)"
                        value={formData.contact}
                        onChange={(e) => handleFieldChange('contact', e.target.value)}
                        onBlur={() => handleFieldBlur('contact')}
                        isInvalid={!!fieldErrors.contact}
                        maxLength={10}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.contact}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        Enter exactly 10 digits starting with 6, 7, 8, or 9
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <strong>🆔 PAN *</strong>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter PAN number (e.g., ABCDE1234F)"
                        value={formData.pan}
                        onChange={(e) => handleFieldChange('pan', e.target.value.toUpperCase())}
                        onBlur={() => handleFieldBlur('pan')}
                        isInvalid={!!fieldErrors.pan}
                        maxLength={10}
                        style={{ textTransform: 'uppercase' }}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.pan}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        Format: 5 letters + 4 digits + 1 letter
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <strong>📧 Email *</strong>
                      </Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="Enter email address (e.g., client@example.com)"
                        value={formData.email}
                        onChange={(e) => handleFieldChange('email', e.target.value.toLowerCase())}
                        onBlur={() => handleFieldBlur('email')}
                        isInvalid={!!fieldErrors.email}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        {fieldErrors.email}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        Valid email address for communication
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                
                <div className="d-flex gap-2 justify-content-end">
                  <Button 
                    variant="secondary" 
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancel & Back
                  </Button>
                  <Button 
                    type="submit" 
                    variant="primary"
                    disabled={loading || Object.keys(fieldErrors).some(key => fieldErrors[key])}
                  >
                    {loading ? 'Saving...' : (editIndex !== null ? 'Update Client' : 'Add Client')}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
    </div>
  );
};

export default ClientForm;
