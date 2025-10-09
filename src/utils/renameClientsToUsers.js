import { ref, get, set, remove } from 'firebase/database';
import { rtdb } from '../firebase';

export const renameClientsToUsers = async () => {
  try {
    console.log("🔄 Starting rename from 'clients' to 'users' in Firebase...");

    // Step 1: Check if 'clients' node exists
    const clientsRef = ref(rtdb, 'clients');
    const clientsSnapshot = await get(clientsRef);
    
    if (!clientsSnapshot.exists()) {
      console.log("ℹ️ No 'clients' node found in Firebase");
      return { 
        success: true, 
        message: "No 'clients' node found to rename" 
      };
    }

    // Step 2: Get all data from 'clients' node
    const clientsData = clientsSnapshot.val();
    console.log("📊 Found clients data:", Object.keys(clientsData));

    // Step 3: Check if 'users' node already exists
    const usersRef = ref(rtdb, 'users');
    const usersSnapshot = await get(usersRef);
    
    if (usersSnapshot.exists()) {
      console.log("⚠️ 'users' node already exists");
      return {
        success: false,
        error: "'users' node already exists. Please check your Firebase console."
      };
    }

    // Step 4: Copy data to 'users' node
    await set(usersRef, clientsData);
    console.log("✅ Data copied to 'users' node");

    // Step 5: Remove the old 'clients' node
    await remove(clientsRef);
    console.log("🗑️ Old 'clients' node removed");

    const userCount = Object.keys(clientsData).length;
    console.log(`🎉 Rename completed! Moved ${userCount} records from 'clients' to 'users'`);
    
    return {
      success: true,
      message: `Successfully renamed 'clients' to 'users'. Moved ${userCount} records.`,
      userCount
    };

  } catch (error) {
    console.error("❌ Rename failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};
