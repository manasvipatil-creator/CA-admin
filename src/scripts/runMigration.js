// src/scripts/runMigration.js
/**
 * Migration script to move data from old structure to new supernode structure
 * 
 * Usage:
 * 1. Update the USER_EMAILS array below with actual user emails from your system
 * 2. Run this script: node src/scripts/runMigration.js
 * 3. Check the console output for migration results
 */

import { migrationUtils, migrateUsers, verifyUserMigration } from '../utils/migrationUtils.js';

// IMPORTANT: Add your actual user emails here (as safe emails with _ instead of .)
const USER_EMAILS = [
  // Example: 'admin_example_com',
  // Example: 'user_test_com',
  // Add your actual user safe emails here
];

async function runMigration() {
  console.log('🚀 Starting CA Admin Supernode Migration...\n');
  
  if (USER_EMAILS.length === 0) {
    console.log('❌ No user emails specified in USER_EMAILS array.');
    console.log('Please update the USER_EMAILS array in this script with your actual user emails.');
    console.log('Convert emails to safe format: user@example.com -> user_example_com\n');
    return;
  }

  try {
    // Step 1: Run migration
    console.log(`📋 Migrating ${USER_EMAILS.length} users...`);
    const migrationResult = await migrateUsers(USER_EMAILS);
    
    if (migrationResult.success) {
      console.log('✅ Migration completed successfully!\n');
    } else {
      console.log('⚠️ Migration completed with some errors.\n');
    }

    // Step 2: Display results
    console.log('📊 Migration Summary:');
    console.log(`Total users: ${migrationResult.summary.total}`);
    console.log(`Successful: ${migrationResult.summary.successful}`);
    console.log(`Failed: ${migrationResult.summary.failed}\n`);

    // Step 3: Verify migration for each user
    console.log('🔍 Verifying migration...');
    for (const userEmail of USER_EMAILS) {
      const verification = await verifyUserMigration(userEmail);
      
      if (verification.error) {
        console.log(`❌ ${userEmail}: Verification failed - ${verification.error}`);
      } else {
        console.log(`✅ ${userEmail}: Profile=${verification.profile}, Clients=${verification.clients}, Banners=${verification.banners}, Admin=${verification.admin}`);
      }
    }

    // Step 4: Display detailed logs if there were errors
    if (migrationResult.summary.errors.length > 0) {
      console.log('\n🚨 Migration Errors:');
      migrationResult.summary.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.timestamp}] ${error.message}`);
        if (error.error) {
          console.log(`   Error: ${error.error}`);
        }
      });
    }

    console.log('\n🎉 Migration process completed!');
    console.log('\nNext steps:');
    console.log('1. Test your application with the new supernode structure');
    console.log('2. Update any remaining components to use new AuthContext functions');
    console.log('3. Once verified, you can safely remove old data structure');
    
  } catch (error) {
    console.error('💥 Migration failed with error:', error);
  }
}

// Helper function to get current user emails from your system
async function getCurrentUsers() {
  console.log('📋 To get current users, check your Firestore console for existing collections.');
  console.log('Look for collections that match email patterns like:');
  console.log('- admin_example_com');
  console.log('- user_test_com');
  console.log('- etc.\n');
  
  console.log('Then add them to the USER_EMAILS array in this script.\n');
}

// Run the migration
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('CA Admin Supernode Migration Script\n');
  console.log('Usage:');
  console.log('  node src/scripts/runMigration.js          # Run migration');
  console.log('  node src/scripts/runMigration.js --help   # Show this help');
  console.log('  node src/scripts/runMigration.js --users  # Show how to find users\n');
} else if (process.argv.includes('--users')) {
  getCurrentUsers();
} else {
  runMigration();
}
