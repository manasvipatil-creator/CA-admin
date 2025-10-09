import { ref, set } from 'firebase/database';
import { rtdb } from '../firebase';

export const createExactFirebaseStructure = async () => {
  try {
    console.log("🏗️ Creating exact Firebase structure...");

    // Create the exact structure as shown in the image
    const structure = {
      "CA Firm": {
        "Admin": {
          "Users": {
            "Users Name 1": {
              "2023": {
                "Documents": {
                  "doc_001": {
                    docName: "Income Tax Return 2023",
                    fileName: "ITR_2023.pdf",
                    year: "2023",
                    fileType: "application/pdf",
                    uploadedAt: new Date().toISOString(),
                    fileSize: "2.5 MB"
                  },
                  "doc_002": {
                    docName: "GST Return March 2023",
                    fileName: "GST_March_2023.pdf",
                    year: "2023",
                    fileType: "application/pdf",
                    uploadedAt: new Date().toISOString(),
                    fileSize: "1.8 MB"
                  }
                }
              },
              "2024": {
                "Documents": {
                  "doc_003": {
                    docName: "Income Tax Return 2024",
                    fileName: "ITR_2024.pdf",
                    year: "2024",
                    fileType: "application/pdf",
                    uploadedAt: new Date().toISOString(),
                    fileSize: "2.8 MB"
                  },
                  "doc_004": {
                    docName: "Audit Report 2024",
                    fileName: "Audit_2024.pdf",
                    year: "2024",
                    fileType: "application/pdf",
                    uploadedAt: new Date().toISOString(),
                    fileSize: "4.2 MB"
                  }
                }
              }
            },
            "Users Name 2": {
              "2024": {
                "Documents": {
                  "doc_005": {
                    docName: "GST Registration 2024",
                    fileName: "GST_Registration_2024.pdf",
                    year: "2024",
                    fileType: "application/pdf",
                    uploadedAt: new Date().toISOString(),
                    fileSize: "1.2 MB"
                  },
                  "doc_006": {
                    docName: "Company Incorporation",
                    fileName: "Incorporation_2024.pdf",
                    year: "2024",
                    fileType: "application/pdf",
                    uploadedAt: new Date().toISOString(),
                    fileSize: "3.1 MB"
                  }
                }
              }
            }
          }
        }
      }
    };

    // Write the structure to Firebase
    await set(ref(rtdb), structure);
    
    console.log("✅ Firebase structure created successfully!");
    console.log("📁 Structure:");
    console.log("CA Firm → Admin → Users → Users Name 1 → 2023 → Documents");
    console.log("CA Firm → Admin → Users → Users Name 1 → 2024 → Documents");
    console.log("CA Firm → Admin → Users → Users Name 2 → 2024 → Documents");

    return { 
      success: true, 
      message: "Firebase structure created successfully!",
      structure: "CA Firm/Admin/Users/{UsersName}/{Year}/Documents"
    };

  } catch (error) {
    console.error("❌ Error creating Firebase structure:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};
