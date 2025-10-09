import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

// This utility can be used to create admin users in Firebase Authentication
export const createAdminUser = async (email, password) => {
  try {
    console.log("👤 Creating admin user:", email);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log("✅ Admin user created successfully:", user.email);
    console.log("🆔 User ID:", user.uid);
    
    return {
      success: true,
      user: {
        email: user.email,
        uid: user.uid
      }
    };
  } catch (error) {
    console.error("❌ Error creating admin user:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Usage example (run this in browser console):
// import { createAdminUser } from './utils/createUser';
// createAdminUser('admin@cadirect.com', 'yourpassword123');
