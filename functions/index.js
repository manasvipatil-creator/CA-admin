const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Sends a notification ONLY to the clients of a specific CA firm.
 * This is called from the CA Firm's admin panel.
 */
exports.sendAdminBroadcast = functions.https.onCall(async (data, context) => {
  try {
    // --- Debug Logging ---
    console.log("🔍 Function called with context:", {
      hasContextAuth: !!context.auth,
      hasDataAuth: !!data.auth,
      contextAuthUid: context.auth?.uid,
      dataAuthUid: data.auth?.uid,
      contextAuthEmail: context.auth?.token?.email,
      dataAuthEmail: data.auth?.token?.email,
    });

  // --- Security Check ---
  // Check both context.auth (correct) and data.auth (fallback for SDK issues)
  const auth = context.auth || data.auth;
  
  if (!auth) {
    console.error("❌ No auth context found in context or data");
    throw new functions.https.HttpsError(
      "unauthenticated",+
      "You must be logged in to send notifications."
    );
  }
  
  console.log("✅ Auth found:", { uid: auth.uid, email: auth.token?.email });

  // Get the data sent from the React app
  // If data.auth exists, the actual data is in data.data (nested)
  const actualData = data.auth ? data.data : data;
  const { title, body, caFirmId, imageUrl } = actualData;

  console.log("📦 Extracted data:", { title, body, caFirmId, hasImage: !!imageUrl });

  if (!title || !body || !caFirmId) {
    console.error("❌ Missing required fields:", { title, body, caFirmId });
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with 'title', 'body', and 'caFirmId'."
    );
  }

  // --- Authorization Check ---
  const loggedInUserEmail = auth.token?.email || auth.email;
  
  if (!loggedInUserEmail) {
    console.error("❌ No email found in auth token:", auth);
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Unable to verify user email from authentication token."
    );
  }
  
  // Sanitize the logged-in user's email (replace dots with underscores)
  const sanitizedLoggedInEmail = loggedInUserEmail.replace(/\./g, "_");
  
  console.log("🔐 Authorization check:", {
    loggedInEmail: loggedInUserEmail,
    sanitizedEmail: sanitizedLoggedInEmail,
    caFirmId: caFirmId,
    match: sanitizedLoggedInEmail === caFirmId
  });
  
  // Compare sanitized emails
  if (sanitizedLoggedInEmail !== caFirmId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You can only send notifications to your own firm's clients."
    );
  }

  // 1. Define the specific path to this firm's clients
  const clientsPath = `ca_admin/${caFirmId}/clients`;
  console.log("📂 Fetching clients from path:", clientsPath);

  // 2. Fetch all documents from that specific subcollection
  const firmClientsSnapshot = await admin
    .firestore()
    .collection(clientsPath)
    .get();

  console.log("👥 Total clients found:", firmClientsSnapshot.size);

  // 3. Collect the FCM tokens for this firm's clients
  const tokens = [];
  console.log("📋 Processing clients from snapshot...");
  
  firmClientsSnapshot.forEach((doc) => {
    const clientData = doc.data();
    console.log(`🔍 Client ${doc.id}:`, {
      hasToken: !!clientData.fcmToken,
      tokenPreview: clientData.fcmToken ? clientData.fcmToken.substring(0, 20) + "..." : "none",
      clientName: clientData.name || "unknown",
      email: clientData.email || "unknown"
    });
    
    if (clientData.fcmToken) {
      tokens.push(clientData.fcmToken);
      console.log("✅ Token added for client:", doc.id);
    } else {
      console.log("⚠️ No FCM token for client:", doc.id);
    }
  });

  console.log("🎯 Total FCM tokens collected:", tokens.length);
  console.log("📱 Token details:", tokens.map((token, idx) => ({
    index: idx,
    tokenStart: token.substring(0, 20),
    tokenLength: token.length
  })));

  if (tokens.length === 0) {
    console.warn("⚠️ No clients with FCM tokens found");
    return {
      success: false,
      message: "This firm has no clients with notification tokens.",
    };
  }

  // 4. Build the notification payload
  const notificationPayload = {
    title,
    body,
  };

  // Add image if provided (Firebase Messaging uses 'imageUrl' for web/Android)
  if (imageUrl) {
    notificationPayload.imageUrl = imageUrl;
  }
  
  console.log("📨 Notification payload:", notificationPayload);

  // 5. Send the multicast message using FCM v1 API
  console.log("📤 Sending to FCM with tokens:", tokens.length);
  
  let response;
  try {
    // Use sendEachForMulticast for better compatibility with FCM v1 API
    response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: notificationPayload,
      android: {
        priority: 'high',
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
      },
    });
    
    console.log("✅ FCM send completed");
  } catch (fcmError) {
    console.error("❌ FCM Error:", fcmError.message);
    console.error("❌ FCM Error Code:", fcmError.code);
    console.error("❌ FCM Error Stack:", fcmError.stack);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to send notifications via FCM: ${fcmError.message}`
    );
  }

  // 6. Log any failures for debugging
  console.log("📊 Send results:", {
    successCount: response.successCount,
    failureCount: response.failureCount,
    totalTokens: tokens.length
  });

  // Log detailed results for each token and clean up invalid ones
  const invalidTokenCleanupPromises = [];
  
  response.responses.forEach((resp, idx) => {
    const tokenPreview = tokens[idx].substring(0, 20) + "...";
    if (resp.success) {
      console.log(`✅ Token ${idx} (${tokenPreview}): SUCCESS - MessageId: ${resp.messageId}`);
    } else {
      console.error(`❌ Token ${idx} (${tokenPreview}): FAILED`);
      console.error(`   Error Code: ${resp.error?.code}`);
      console.error(`   Error Message: ${resp.error?.message}`);
      
      // If token is invalid/unregistered, remove it from database
      if (resp.error?.code === 'messaging/registration-token-not-registered' || 
          resp.error?.code === 'messaging/invalid-registration-token') {
        
        console.log(`🧹 Cleaning up invalid token for client at index ${idx}`);
        
        // Find the client document and remove the invalid token
        const clientDocs = [];
        firmClientsSnapshot.forEach((doc) => clientDocs.push(doc));
        
        if (clientDocs[idx]) {
          const cleanupPromise = admin.firestore()
            .collection(clientsPath)
            .doc(clientDocs[idx].id)
            .update({ fcmToken: admin.firestore.FieldValue.delete() })
            .then(() => {
              console.log(`✅ Removed invalid token from client: ${clientDocs[idx].id}`);
            })
            .catch((error) => {
              console.error(`❌ Failed to remove invalid token from client ${clientDocs[idx].id}:`, error);
            });
          
          invalidTokenCleanupPromises.push(cleanupPromise);
        }
      }
    }
  });
  
  // Wait for all cleanup operations to complete
  if (invalidTokenCleanupPromises.length > 0) {
    console.log(`🧹 Cleaning up ${invalidTokenCleanupPromises.length} invalid tokens...`);
    await Promise.allSettled(invalidTokenCleanupPromises);
  }

  if (response.failureCount > 0) {
    console.error(`❌ Failed to send to ${response.failureCount} clients`);
  }

  const successMessage = `Notification sent to ${response.successCount} of ${tokens.length} of your clients.`;
  console.log("✅ " + successMessage);

  return {
    success: true,
    message: successMessage,
    failureCount: response.failureCount,
  };
  
  } catch (error) {
    console.error("💥 FATAL ERROR in sendCaFirmBroadcast:", error);
    console.error("💥 Error stack:", error.stack);
    console.error("💥 Error details:", {
      message: error.message,
      code: error.code,
      name: error.name
    });
    
    // Re-throw as HttpsError if it's already one
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Otherwise wrap in internal error
    throw new functions.https.HttpsError(
      "internal",
      `Internal server error: ${error.message}`
    );
  }
});
