// src/utils/firestoreHelpers.js
import {
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Firestore Helper Functions for CA Admin System
 */

// Generic CRUD Operations
export const firestoreHelpers = {
  // Create document with auto-generated ID
  async create(collectionRef, data) {
    try {
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("✅ Document created with ID:", docRef.id);
      return docRef;
    } catch (error) {
      console.error("❌ Error creating document:", error);
      throw error;
    }
  },

  // Create/Update document with specific ID
  async set(docRef, data, merge = true) {
    try {
      await setDoc(
        docRef,
        {
          ...data,
          updatedAt: serverTimestamp(),
        },
        { merge }
      );
      console.log("✅ Document set successfully");
      return docRef;
    } catch (error) {
      console.error("❌ Error setting document:", error);
      throw error;
    }
  },

  // Read single document
  async get(docRef) {
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        console.log("📭 No such document!");
        return null;
      }
    } catch (error) {
      console.error("❌ Error getting document:", error);
      throw error;
    }
  },

  // Read collection
  async getCollection(collectionRef, queryConstraints = []) {
    try {
      const q =
        queryConstraints.length > 0
          ? query(collectionRef, ...queryConstraints)
          : collectionRef;

      const querySnapshot = await getDocs(q);
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      console.log(`✅ Retrieved ${docs.length} documents`);
      return docs;
    } catch (error) {
      console.error("❌ Error getting collection:", error);
      throw error;
    }
  },

  // Update document
  async update(docRef, data) {
    try {
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(docRef, updateData);
      console.log("✅ Document updated successfully at:", docRef.path);
      console.log("📊 Updated fields:", Object.keys(data).join(", "));
      return docRef;
    } catch (error) {
      console.error("❌ Error updating document:", error);
      throw error;
    }
  },

  // Delete document
  async delete(docRef) {
    try {
      await deleteDoc(docRef);
      console.log("✅ Document deleted successfully");
      return true;
    } catch (error) {
      console.error("❌ Error deleting document:", error);
      throw error;
    }
  },

  // Real-time listener
  subscribe(docOrCollectionRef, callback, errorCallback) {
    try {
      console.log("🔗 Setting up Firestore listener");
      console.log("📍 Reference type:", docOrCollectionRef.type || "unknown");
      console.log("📍 Reference path:", docOrCollectionRef.path);

      const unsubscribe = onSnapshot(
        docOrCollectionRef,
        (snapshot) => {
          console.log("🎯 SNAPSHOT RECEIVED!");
          console.log("📊 Snapshot metadata:", snapshot.metadata);
          console.log("📊 Snapshot size:", snapshot.size);
          console.log("📊 Snapshot empty:", snapshot.empty);

          if (snapshot.docs) {
            // Collection snapshot
            const docs = [];
            snapshot.forEach((doc) => {
              docs.push({ id: doc.id, ...doc.data() });
            });
            console.log(
              `📊 Listener received ${docs.length} documents from collection`
            );
            console.log("📋 Documents:", docs);
            callback(docs);
          } else {
            // Document snapshot
            if (snapshot.exists()) {
              const data = { id: snapshot.id, ...snapshot.data() };
              console.log("📄 Listener received document:", data);
              callback(data);
            } else {
              console.log("📭 Document does not exist");
              callback(null);
            }
          }
        },
        (error) => {
          console.error("❌ Listener error:", error);
          if (errorCallback) errorCallback(error);
        }
      );

      console.log("✅ Listener setup complete, unsubscribe function created");
      return unsubscribe;
    } catch (error) {
      console.error("❌ Error setting up listener:", error);
      throw error;
    }
  },
};

// Specific helper functions for CA Admin

// Client Operations
export const clientHelpers = {
  async createClient(clientsRef, clientData) {
    // Validate contact number
    if (!clientData.contact || clientData.contact.trim().length === 0) {
      throw new Error("Contact number is required");
    }

    // Sanitize contact number for use as document ID (remove all non-digits)
    const sanitizedContact = clientData.contact.replace(/\D/g, '');

    // Validate contact format (must be exactly 10 digits starting with 6-9)
    if (sanitizedContact.length !== 10) {
      throw new Error("Contact number must be exactly 10 digits");
    }
    if (!/^[6-9]\d{9}$/.test(sanitizedContact)) {
      throw new Error("Contact number must start with 6, 7, 8, or 9");
    }

    // Validate PAN number (still required as a field)
    if (!clientData.pan || clientData.pan.trim().length === 0) {
      throw new Error("PAN number is required");
    }

    // Sanitize PAN (uppercase, remove special chars)
    const sanitizedPAN = clientData.pan
      .toString()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    // Validate PAN format (5 letters + 4 digits + 1 letter)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(sanitizedPAN)) {
      throw new Error("Invalid PAN format. Expected format: ABCDE1234F");
    }

    console.log("🆔 Creating client with Contact as ID:", sanitizedContact);

    // Use Contact number as document ID
    const clientDocRef = doc(clientsRef, sanitizedContact);
    return await firestoreHelpers.set(clientDocRef, {
      name: clientData.name,
      contact: sanitizedContact, // Store sanitized contact
      pan: sanitizedPAN, // Store sanitized PAN
      email: clientData.email,
      firmId: clientData.firmId, // Add firmId here
      years: clientData.years || [],
      isActive: clientData.isActive !== undefined ? clientData.isActive : true, // Default to active
    });
  },

  async updateClient(clientDocRef, clientData) {
    console.log("📝 Updating client in Firestore:", clientDocRef.path, "with data:", clientData);
    return await firestoreHelpers.update(clientDocRef, clientData);
  },

  async deleteClient(clientDocRef) {
    return await firestoreHelpers.delete(clientDocRef);
  },

  async getClients(clientsCollectionRef) {
    try {
      // Get all client documents from the clients collection
      const snapshot = await getDocs(clientsCollectionRef);
      const clients = [];

      snapshot.forEach((doc) => {
        clients.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // Sort clients by name
      clients.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return clients;
    } catch (error) {
      console.error("❌ Error getting clients:", error);
      throw error;
    }
  },

  subscribeToClients(clientsCollectionRef, callback, errorCallback) {
    try {
      // Subscribe to the clients collection
      const q = query(clientsCollectionRef, orderBy("name", "asc"));
      return onSnapshot(
        q,
        (snapshot) => {
          const clients = [];
          snapshot.forEach((doc) => {
            clients.push({
              id: doc.id,
              ...doc.data(),
            });
          });
          callback(clients);
        },
        errorCallback
      );
    } catch (error) {
      if (errorCallback) errorCallback(error);
      return () => {};
    }
  },
};

// Document Operations
export const documentHelpers = {
  async createDocument(documentsRef, documentData) {
    return await firestoreHelpers.create(documentsRef, {
      name: documentData.name,
      docName: documentData.docName,
      year: documentData.year,
      fileName: documentData.fileName,
      fileUrl: documentData.fileUrl,
      fileData: documentData.fileData,
      fileSize: documentData.fileSize,
      fileType: documentData.fileType,
      uploadedAt: documentData.uploadedAt,
      uploadedBy: documentData.uploadedBy,
    });
  },

  async updateDocument(documentDocRef, documentData) {
    return await firestoreHelpers.update(documentDocRef, {
      name: documentData.name,
      docName: documentData.docName,
      year: documentData.year,
      fileName: documentData.fileName,
      fileUrl: documentData.fileUrl,
      fileData: documentData.fileData,
      fileSize: documentData.fileSize,
      fileType: documentData.fileType,
      uploadedAt: documentData.uploadedAt,
      uploadedBy: documentData.uploadedBy,
    });
  },

  async deleteDocument(documentDocRef) {
    return await firestoreHelpers.delete(documentDocRef);
  },

  async getDocuments(documentsRef) {
    return await firestoreHelpers.getCollection(documentsRef, [
      orderBy("createdAt", "desc"),
    ]);
  },

  subscribeToDocuments(documentsRef, callback, errorCallback) {
    const q = query(documentsRef, orderBy("createdAt", "desc"));
    return firestoreHelpers.subscribe(q, callback, errorCallback);
  },
};

// Banner Operations
export const bannerHelpers = {
  async createBanner(bannersRef, bannerName, bannerData) {
    const bannerDocRef = doc(bannersRef, bannerName);
    return await firestoreHelpers.set(bannerDocRef, {
      bannerName: bannerData.bannerName,
      imageUrl: bannerData.imageUrl,
      imagePath: bannerData.imagePath,
      isActive: bannerData.isActive,
      createdAt: bannerData.createdAt,
      updatedAt: bannerData.updatedAt,
      fileName: bannerData.fileName,
      fileSize: bannerData.fileSize,
      fileType: bannerData.fileType,
      note: bannerData.note,
    });
  },

  async updateBanner(bannerDocRef, bannerData) {
    return await firestoreHelpers.update(bannerDocRef, bannerData);
  },

  async deleteBanner(bannerDocRef) {
    return await firestoreHelpers.delete(bannerDocRef);
  },

  async getBanners(bannersRef) {
    console.log("📋 Manual getBanners called for path:", bannersRef.path);
    // Remove orderBy for now to test basic functionality
    return await firestoreHelpers.getCollection(bannersRef);
  },

  subscribeToBanners(bannersRef, callback, errorCallback) {
    console.log("🔗 Setting up banners subscription");
    console.log("📍 Collection reference path:", bannersRef.path);

    // Enhanced error callback to catch listener issues
    const enhancedErrorCallback = (error) => {
      console.error("❌ Banner subscription error:", error);
      console.error("❌ Error code:", error.code);
      console.error("❌ Error message:", error.message);
      if (errorCallback) errorCallback(error);
    };

    // Enhanced success callback to ensure we're getting data
    const enhancedCallback = (bannersList) => {
      console.log("🎯 Banner subscription callback triggered!");
      console.log("📊 Received banners:", bannersList.length);
      console.log("📋 Banner data:", bannersList);
      callback(bannersList);
    };

    console.log("📋 Setting up basic subscription (no orderBy)...");
    return firestoreHelpers.subscribe(
      bannersRef,
      enhancedCallback,
      enhancedErrorCallback
    );
  },
};

// Notification Operations
export const notificationHelpers = {
  async createNotification(notificationsRef, notificationData) {
    const data = {
      title: notificationData.title,
      message: notificationData.message,
      priority: notificationData.priority,
    };
    
    // Only add image-related fields if they exist
    if (notificationData.imageUrl) {
      data.imageUrl = notificationData.imageUrl;
    }
    if (notificationData.imagePath) {
      data.imagePath = notificationData.imagePath;
    }
    if (notificationData.fileName) {
      data.fileName = notificationData.fileName;
    }
    if (notificationData.fileSize) {
      data.fileSize = notificationData.fileSize;
    }
    if (notificationData.fileType) {
      data.fileType = notificationData.fileType;
    }
    
    return await firestoreHelpers.create(notificationsRef, data);
  },

  async updateNotification(notificationDocRef, notificationData) {
    const data = {
      title: notificationData.title,
      message: notificationData.message,
      priority: notificationData.priority,
    };
    
    // Only add image-related fields if they exist
    if (notificationData.imageUrl) {
      data.imageUrl = notificationData.imageUrl;
    }
    if (notificationData.imagePath) {
      data.imagePath = notificationData.imagePath;
    }
    if (notificationData.fileName) {
      data.fileName = notificationData.fileName;
    }
    if (notificationData.fileSize) {
      data.fileSize = notificationData.fileSize;
    }
    if (notificationData.fileType) {
      data.fileType = notificationData.fileType;
    }
    
    return await firestoreHelpers.update(notificationDocRef, data);
  },

  async deleteNotification(notificationDocRef) {
    return await firestoreHelpers.delete(notificationDocRef);
  },

  async getNotifications(notificationsRef) {
    return await firestoreHelpers.getCollection(notificationsRef, [
      orderBy("createdAt", "desc"),
    ]);
  },

  subscribeToNotifications(notificationsRef, callback, errorCallback) {
    const q = query(notificationsRef, orderBy("createdAt", "desc"));
    return firestoreHelpers.subscribe(q, callback, errorCallback);
  },
};

// Admin/Image Operations
export const adminHelpers = {
  async uploadImage(adminRef, imageId, imageData) {
    const imageDocRef = doc(adminRef, "uploadedImages");
    const imagesCollectionRef = collection(imageDocRef, "images");
    const specificImageRef = doc(imagesCollectionRef, imageId);

    return await firestoreHelpers.set(specificImageRef, {
      name: imageData.name,
      fileName: imageData.fileName,
      url: imageData.url,
      size: imageData.size,
      type: imageData.type,
      uploadedBy: imageData.uploadedBy,
    });
  },

  async deleteImage(adminRef, imageId) {
    const imageDocRef = doc(adminRef, "uploadedImages");
    const imagesCollectionRef = collection(imageDocRef, "images");
    const specificImageRef = doc(imagesCollectionRef, imageId);

    return await firestoreHelpers.delete(specificImageRef);
  },

  async getImages(adminRef) {
    const imageDocRef = doc(adminRef, "uploadedImages");
    const imagesCollectionRef = collection(imageDocRef, "images");

    return await firestoreHelpers.getCollection(imagesCollectionRef, [
      orderBy("createdAt", "desc"),
    ]);
  },

  subscribeToImages(adminRef, callback, errorCallback) {
    const imageDocRef = doc(adminRef, "uploadedImages");
    const imagesCollectionRef = collection(imageDocRef, "images");
    const q = query(imagesCollectionRef, orderBy("createdAt", "desc"));

    return firestoreHelpers.subscribe(q, callback, errorCallback);
  },
};

// Years and Generic Documents Operations
export const yearsHelpers = {
  // Get years subcollection reference for a client
  getYearsCollectionRef(clientDocRef) {
    return collection(clientDocRef, "years");
  },

  // Get a specific year document reference
  getYearDocRef(clientDocRef, yearId) {
    return doc(collection(clientDocRef, "years"), yearId);
  },

  // Create or update a year document
  async createOrUpdateYear(clientDocRef, yearId, yearData) {
    const yearDocRef = doc(collection(clientDocRef, "years"), yearId);
    return await firestoreHelpers.set(yearDocRef, yearData);
  },

  // Get all years for a client
  async getYears(clientDocRef) {
    const yearsCollectionRef = collection(clientDocRef, "years");
    return await firestoreHelpers.getCollection(yearsCollectionRef);
  },

  // Subscribe to years collection
  subscribeToYears(clientDocRef, callback, errorCallback) {
    const yearsCollectionRef = collection(clientDocRef, "years");
    return firestoreHelpers.subscribe(yearsCollectionRef, callback, errorCallback);
  },

  // Get generic documents count across all years
  async getGenericDocumentsCount(clientDocRef) {
    try {
      const yearsCollectionRef = collection(clientDocRef, "years");
      const yearsSnapshot = await getDocs(yearsCollectionRef);
      let totalCount = 0;

      for (const yearDoc of yearsSnapshot.docs) {
        const genericDocs = yearDoc.data().genericDocuments || [];
        totalCount += Array.isArray(genericDocs) ? genericDocs.length : 0;
      }

      return totalCount;
    } catch (error) {
      console.error("❌ Error getting generic documents count:", error);
      return 0;
    }
  },
};

export default firestoreHelpers;
