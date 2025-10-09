import { rtdb } from '../firebase';
import { ref, get, remove } from 'firebase/database';

export const cleanupPlaceholderDocuments = async () => {
  try {
    console.log("🧹 Starting placeholder cleanup...");
    
    // Get all users from CA Firm structure
    const usersRef = ref(rtdb, 'CA Firm/Admin/Users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      console.log("❌ No users found");
      return { success: false, error: "No users found" };
    }
    
    const users = snapshot.val();
    let cleanedCount = 0;
    
    // Iterate through each user
    for (const [userName, userData] of Object.entries(users)) {
      console.log(`🔍 Checking user: ${userName}`);
      
      // Iterate through each year for this user
      for (const [key, value] of Object.entries(userData)) {
        // Check if key is a year (4 digits)
        if (/^\d{4}$/.test(key) && parseInt(key) >= 1900 && parseInt(key) <= 2100) {
          console.log(`📅 Checking year: ${key} for user: ${userName}`);
          
          if (value && value.documents) {
            // Check each document in this year
            for (const [docId, doc] of Object.entries(value.documents)) {
              if (doc && isPlaceholderDocument(doc)) {
                console.log(`🗑️ Removing placeholder document: ${docId}`);
                console.log(`📄 Document name: ${doc.docName || doc.name}`);
                
                // Remove the placeholder document
                const docRef = ref(rtdb, `CA Firm/Admin/Users/${userName}/${key}/documents/${docId}`);
                await remove(docRef);
                cleanedCount++;
                
                console.log(`✅ Removed: ${docId}`);
              }
            }
          }
        }
      }
    }
    
    console.log(`🎉 Cleanup completed! Removed ${cleanedCount} placeholder documents.`);
    return { success: true, cleanedCount };
    
  } catch (error) {
    console.error("❌ Cleanup error:", error);
    return { success: false, error: error.message };
  }
};

// Helper function to identify placeholder documents
const isPlaceholderDocument = (doc) => {
  if (!doc) return false;
  
  const docName = doc.docName || doc.name || '';
  const fileName = doc.fileName || '';
  
  // Check for various placeholder patterns
  const isPlaceholder = (
    fileName === 'placeholder.txt' ||
    docName.includes('Initial Setup') ||
    docName.includes('Year 20') ||
    docName === 'placeholder' ||
    fileName === '' ||
    docName === ''
  );
  
  if (isPlaceholder) {
    console.log(`🔍 Identified placeholder: ${docName} (${fileName})`);
  }
  
  return isPlaceholder;
};
