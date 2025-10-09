// src/utils/migrationUtils.js
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  writeBatch, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

// Constants for migration
const SUPERNODE_ROOT = 'ca_admin';
const USERS_COLLECTION = 'users';
const BATCH_SIZE = 500; // Firestore batch limit

/**
 * Migration utility class for moving data from old structure to new supernode structure
 */
export class DataMigrationUtils {
  constructor() {
    this.migrationLog = [];
    this.errors = [];
  }

  /**
   * Log migration activity
   */
  log(message, type = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      message
    };
    this.migrationLog.push(logEntry);
    console.log(`[MIGRATION ${type.toUpperCase()}] ${message}`);
  }

  /**
   * Log migration errors
   */
  logError(message, error) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message,
      error: error.message || error
    };
    this.errors.push(errorEntry);
    console.error(`[MIGRATION ERROR] ${message}`, error);
  }

  /**
   * Get all user collections from old structure
   */
  async getOldUserCollections() {
    try {
      this.log('Scanning for existing user collections...');
      
      // Get all collections at root level that match email pattern
      const rootCollections = await db._delegate._databaseId;
      
      // For now, we'll need to manually specify known user emails
      // In production, you might want to maintain a users registry
      const knownUsers = [
        // Add known user emails here, e.g.:
        // 'admin_example_com',
        // 'user_test_com'
      ];
      
      this.log(`Found ${knownUsers.length} known user collections`);
      return knownUsers;
    } catch (error) {
      this.logError('Failed to get old user collections', error);
      return [];
    }
  }

  /**
   * Migrate a single user's data from old structure to new supernode structure
   */
  async migrateUserData(safeEmail) {
    try {
      this.log(`Starting migration for user: ${safeEmail}`);
      
      const batch = writeBatch(db);
      let operationCount = 0;

      // 1. Create user profile document
      await this.createUserProfile(safeEmail, batch);
      operationCount++;

      // 2. Migrate clients data
      const clientsCount = await this.migrateUserClients(safeEmail, batch);
      operationCount += clientsCount;

      // 3. Migrate banners data
      const bannersCount = await this.migrateUserBanners(safeEmail, batch);
      operationCount += bannersCount;

      // 4. Migrate admin data
      const adminCount = await this.migrateUserAdmin(safeEmail, batch);
      operationCount += adminCount;

      // Execute batch if there are operations
      if (operationCount > 0) {
        await batch.commit();
        this.log(`Successfully migrated ${operationCount} documents for user: ${safeEmail}`);
      } else {
        this.log(`No data found to migrate for user: ${safeEmail}`);
      }

      return { success: true, operationCount };
    } catch (error) {
      this.logError(`Failed to migrate user data for ${safeEmail}`, error);
      return { success: false, error };
    }
  }

  /**
   * Create user profile document in new structure
   */
  async createUserProfile(safeEmail, batch) {
    try {
      // Convert safe email back to regular email for profile
      const email = safeEmail.replace(/_/g, '.');
      
      const profileRef = doc(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'profile');
      
      const profileData = {
        email: email,
        name: email.split('@')[0], // Use email prefix as default name
        role: 'user',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        migratedAt: serverTimestamp()
      };

      batch.set(profileRef, profileData);
      this.log(`Created profile for user: ${safeEmail}`);
    } catch (error) {
      this.logError(`Failed to create profile for ${safeEmail}`, error);
      throw error;
    }
  }

  /**
   * Migrate user's clients data
   */
  async migrateUserClients(safeEmail, batch) {
    try {
      // Old path: {safeEmail}/user/clients
      const oldClientsRef = collection(db, safeEmail, 'user', 'clients');
      const clientsSnapshot = await getDocs(oldClientsRef);
      
      let count = 0;
      
      for (const clientDoc of clientsSnapshot.docs) {
        const clientData = clientDoc.data();
        
        // New path: ca_admin/users/{safeEmail}/data/clients/{clientId}
        const newClientRef = doc(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'data', 'clients', clientDoc.id);
        
        // Add migration metadata
        const migratedClientData = {
          ...clientData,
          migratedAt: serverTimestamp(),
          migratedFrom: `${safeEmail}/user/clients/${clientDoc.id}`
        };
        
        batch.set(newClientRef, migratedClientData);
        count++;

        // Migrate client's years and documents
        await this.migrateClientYears(safeEmail, clientDoc.id, batch);
      }
      
      this.log(`Migrated ${count} clients for user: ${safeEmail}`);
      return count;
    } catch (error) {
      this.logError(`Failed to migrate clients for ${safeEmail}`, error);
      return 0;
    }
  }

  /**
   * Migrate client's years and documents
   */
  async migrateClientYears(safeEmail, clientId, batch) {
    try {
      // Old path: {safeEmail}/user/clients/{clientId}/years
      const oldYearsRef = collection(db, safeEmail, 'user', 'clients', clientId, 'years');
      const yearsSnapshot = await getDocs(oldYearsRef);
      
      for (const yearDoc of yearsSnapshot.docs) {
        const yearData = yearDoc.data();
        
        // New path: ca_admin/users/{safeEmail}/data/clients/{clientId}/years/{year}
        const newYearRef = doc(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'data', 'clients', clientId, 'years', yearDoc.id);
        
        const migratedYearData = {
          ...yearData,
          migratedAt: serverTimestamp(),
          migratedFrom: `${safeEmail}/user/clients/${clientId}/years/${yearDoc.id}`
        };
        
        batch.set(newYearRef, migratedYearData);

        // Migrate year's documents
        await this.migrateYearDocuments(safeEmail, clientId, yearDoc.id, batch);
      }
    } catch (error) {
      this.logError(`Failed to migrate years for client ${clientId}`, error);
    }
  }

  /**
   * Migrate year's documents
   */
  async migrateYearDocuments(safeEmail, clientId, year, batch) {
    try {
      // Old path: {safeEmail}/user/clients/{clientId}/years/{year}/documents
      const oldDocsRef = collection(db, safeEmail, 'user', 'clients', clientId, 'years', year, 'documents');
      const docsSnapshot = await getDocs(oldDocsRef);
      
      for (const docDoc of docsSnapshot.docs) {
        const docData = docDoc.data();
        
        // New path: ca_admin/users/{safeEmail}/data/clients/{clientId}/years/{year}/documents/{docId}
        const newDocRef = doc(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'data', 'clients', clientId, 'years', year, 'documents', docDoc.id);
        
        const migratedDocData = {
          ...docData,
          migratedAt: serverTimestamp(),
          migratedFrom: `${safeEmail}/user/clients/${clientId}/years/${year}/documents/${docDoc.id}`
        };
        
        batch.set(newDocRef, migratedDocData);
      }
    } catch (error) {
      this.logError(`Failed to migrate documents for ${clientId}/${year}`, error);
    }
  }

  /**
   * Migrate user's banners data
   */
  async migrateUserBanners(safeEmail, batch) {
    try {
      // Old path: {safeEmail}/user/banners
      const oldBannersRef = collection(db, safeEmail, 'user', 'banners');
      const bannersSnapshot = await getDocs(oldBannersRef);
      
      let count = 0;
      
      for (const bannerDoc of bannersSnapshot.docs) {
        const bannerData = bannerDoc.data();
        
        // New path: ca_admin/users/{safeEmail}/data/banners/{bannerId}
        const newBannerRef = doc(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'data', 'banners', bannerDoc.id);
        
        const migratedBannerData = {
          ...bannerData,
          migratedAt: serverTimestamp(),
          migratedFrom: `${safeEmail}/user/banners/${bannerDoc.id}`
        };
        
        batch.set(newBannerRef, migratedBannerData);
        count++;
      }
      
      this.log(`Migrated ${count} banners for user: ${safeEmail}`);
      return count;
    } catch (error) {
      this.logError(`Failed to migrate banners for ${safeEmail}`, error);
      return 0;
    }
  }

  /**
   * Migrate user's admin data
   */
  async migrateUserAdmin(safeEmail, batch) {
    try {
      // Old path: {safeEmail}/user/admin
      const oldAdminRef = collection(db, safeEmail, 'user', 'admin');
      const adminSnapshot = await getDocs(oldAdminRef);
      
      let count = 0;
      
      for (const adminDoc of adminSnapshot.docs) {
        const adminData = adminDoc.data();
        
        // New path: ca_admin/users/{safeEmail}/data/admin/{adminDocId}
        const newAdminRef = doc(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'data', 'admin', adminDoc.id);
        
        const migratedAdminData = {
          ...adminData,
          migratedAt: serverTimestamp(),
          migratedFrom: `${safeEmail}/user/admin/${adminDoc.id}`
        };
        
        batch.set(newAdminRef, migratedAdminData);
        count++;

        // If this is the uploadedImages document, migrate its images subcollection
        if (adminDoc.id === 'uploadedImages') {
          await this.migrateAdminImages(safeEmail, batch);
        }
      }
      
      this.log(`Migrated ${count} admin documents for user: ${safeEmail}`);
      return count;
    } catch (error) {
      this.logError(`Failed to migrate admin data for ${safeEmail}`, error);
      return 0;
    }
  }

  /**
   * Migrate admin images subcollection
   */
  async migrateAdminImages(safeEmail, batch) {
    try {
      // Old path: {safeEmail}/user/admin/uploadedImages/images
      const oldImagesRef = collection(db, safeEmail, 'user', 'admin', 'uploadedImages', 'images');
      const imagesSnapshot = await getDocs(oldImagesRef);
      
      for (const imageDoc of imagesSnapshot.docs) {
        const imageData = imageDoc.data();
        
        // New path: ca_admin/users/{safeEmail}/data/admin/uploadedImages/images/{imageId}
        const newImageRef = doc(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'data', 'admin', 'uploadedImages', 'images', imageDoc.id);
        
        const migratedImageData = {
          ...imageData,
          migratedAt: serverTimestamp(),
          migratedFrom: `${safeEmail}/user/admin/uploadedImages/images/${imageDoc.id}`
        };
        
        batch.set(newImageRef, migratedImageData);
      }
    } catch (error) {
      this.logError(`Failed to migrate admin images for ${safeEmail}`, error);
    }
  }

  /**
   * Run complete migration for all users
   */
  async runFullMigration(userEmails = []) {
    try {
      this.log('Starting full data migration to supernode structure...');
      
      const usersToMigrate = userEmails.length > 0 ? userEmails : await this.getOldUserCollections();
      
      if (usersToMigrate.length === 0) {
        this.log('No users found to migrate. Please provide user emails manually.');
        return { success: false, message: 'No users to migrate' };
      }

      const results = [];
      
      for (const safeEmail of usersToMigrate) {
        const result = await this.migrateUserData(safeEmail);
        results.push({ user: safeEmail, ...result });
      }
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      this.log(`Migration completed: ${successCount} successful, ${failureCount} failed`);
      
      return {
        success: failureCount === 0,
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          migrationLog: this.migrationLog,
          errors: this.errors
        }
      };
    } catch (error) {
      this.logError('Full migration failed', error);
      return { success: false, error };
    }
  }

  /**
   * Verify migration by checking if data exists in new structure
   */
  async verifyMigration(safeEmail) {
    try {
      this.log(`Verifying migration for user: ${safeEmail}`);
      
      const verification = {
        user: safeEmail,
        profile: false,
        clients: 0,
        banners: 0,
        admin: 0,
        errors: []
      };

      // Check profile
      const profileRef = doc(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'profile');
      const profileDoc = await getDoc(profileRef);
      verification.profile = profileDoc.exists();

      // Check clients
      const clientsRef = collection(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'data', 'clients');
      const clientsSnapshot = await getDocs(clientsRef);
      verification.clients = clientsSnapshot.size;

      // Check banners
      const bannersRef = collection(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'data', 'banners');
      const bannersSnapshot = await getDocs(bannersRef);
      verification.banners = bannersSnapshot.size;

      // Check admin
      const adminRef = collection(db, SUPERNODE_ROOT, USERS_COLLECTION, safeEmail, 'data', 'admin');
      const adminSnapshot = await getDocs(adminRef);
      verification.admin = adminSnapshot.size;

      this.log(`Verification complete for ${safeEmail}: Profile=${verification.profile}, Clients=${verification.clients}, Banners=${verification.banners}, Admin=${verification.admin}`);
      
      return verification;
    } catch (error) {
      this.logError(`Verification failed for ${safeEmail}`, error);
      return { user: safeEmail, error: error.message };
    }
  }
}

// Export singleton instance
export const migrationUtils = new DataMigrationUtils();

// Helper function to run migration for specific users
export const migrateUsers = async (userEmails) => {
  return await migrationUtils.runFullMigration(userEmails);
};

// Helper function to verify migration
export const verifyUserMigration = async (safeEmail) => {
  return await migrationUtils.verifyMigration(safeEmail);
};
