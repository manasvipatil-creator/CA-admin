import { ref, get, set, remove } from 'firebase/database';
import { rtdb } from '../firebase';

export const migrateToYearStructure = async () => {
  try {
    console.log("🔄 Starting migration to year structure...");

    // Get all clients
    const clientsRef = ref(rtdb, 'clients');
    const snapshot = await get(clientsRef);
    
    if (!snapshot.exists()) {
      console.log("No clients found to migrate");
      return { success: true, message: "No clients found" };
    }

    const clients = snapshot.val();
    let migratedClients = 0;
    let totalDocuments = 0;

    for (const [clientKey, clientData] of Object.entries(clients)) {
      console.log(`📊 Processing client: ${clientKey}`);
      
      // Check if client has documents in old structure
      if (clientData.documents && typeof clientData.documents === 'object') {
        console.log(`📄 Found documents for ${clientKey}, migrating...`);
        
        // Group documents by year
        const documentsByYear = {};
        
        Object.entries(clientData.documents).forEach(([docId, docData]) => {
          const year = docData.year || new Date().getFullYear().toString();
          
          if (!documentsByYear[year]) {
            documentsByYear[year] = {};
          }
          
          documentsByYear[year][docId] = docData;
          totalDocuments++;
        });

        // Create new structure with year nodes
        const newClientData = {
          name: clientData.name,
          contact: clientData.contact,
          email: clientData.email,
          pan: clientData.pan
        };

        // Add year nodes with documents
        Object.entries(documentsByYear).forEach(([year, docs]) => {
          newClientData[year] = {
            documents: docs
          };
        });

        // Update client in Firebase
        await set(ref(rtdb, `clients/${clientKey}`), newClientData);
        migratedClients++;
        
        console.log(`✅ Migrated ${clientKey} with years: ${Object.keys(documentsByYear).join(', ')}`);
      } else {
        console.log(`ℹ️ Client ${clientKey} has no documents to migrate`);
      }
    }

    console.log(`🎉 Migration completed! Migrated ${migratedClients} clients with ${totalDocuments} documents`);
    
    return {
      success: true,
      message: `Successfully migrated ${migratedClients} clients with ${totalDocuments} documents to year structure`,
      migratedClients,
      totalDocuments
    };

  } catch (error) {
    console.error("❌ Migration failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};
