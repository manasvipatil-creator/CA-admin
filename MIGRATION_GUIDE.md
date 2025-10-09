# CA Admin Supernode Migration Guide

## Overview

This guide helps you migrate your CA Admin system from the current structure to a new **supernode structure** that organizes all users under a common root collection.

## Migration Structure

### Before (Current Structure)
```
{userEmail_sanitized}/         // Root collection (e.g., "admin_example_com")
└── user/                      // User document
    ├── clients/               // Clients subcollection
    ├── banners/               // Banners subcollection
    └── admin/                 // Admin subcollection
```

### After (New Supernode Structure - Clean, No Dummy Nodes)
```
ca_admin/                      // Supernode (organization root)
└── {userEmail_sanitized}/     // User document (e.g., "admin_example_com")
    ├
    ├── clients/               // Clients subcollection
    ├── banners/               // Banners subcollection
    └── admin/                 // Admin subcollection
```

## Benefits of Supernode Structure

- ✅ **Better Organization**: All users under one root collection
- ✅ **Scalability**: Easy to add organization-level features
- ✅ **Security**: Better Firestore security rules
- ✅ **Multi-tenancy**: Future support for multiple organizations
- ✅ **User Management**: Centralized user profiles

## Migration Process

### Step 1: Backup Your Data
**CRITICAL**: Always backup your Firestore data before migration!

```bash
# Using Firebase CLI
firebase firestore:export gs://your-bucket/backup-$(date +%Y%m%d)
```

### Step 2: Update AuthContext (✅ COMPLETED)
The `AuthContext.js` has been updated with new supernode path functions:

- `getUserDocRef()` - Points to `ca_admin/users/{safeEmail}`
- `getUserProfileRef()` - Points to `ca_admin/users/{safeEmail}/profile`
- `getUserClientsRef()` - Points to `ca_admin/users/{safeEmail}/clients`
- And all other path functions updated accordingly

### Step 3: Run Migration

#### Option A: Using Migration Panel (Recommended)
1. Import and add `MigrationPanel` component to your admin area:
```jsx
import MigrationPanel from './components/admin/MigrationPanel';

// Add to your admin routes
<Route path="/migration" element={<MigrationPanel />} />
```

2. Navigate to the migration panel in your app
3. Click "Migrate Current User" or enter multiple emails for batch migration
4. Monitor the logs and verify results

#### Option B: Using Command Line Script
1. Update `src/scripts/runMigration.js` with your user emails:
```javascript
const USER_EMAILS = [
  'admin_example_com',    // admin@example.com
  'user_test_com',        // user@test.com
  // Add your actual user emails here (converted to safe format)
];
```

2. Run the migration script:
```bash
node src/scripts/runMigration.js
```

#### Option C: Programmatic Migration
```javascript
import { migrationUtils } from './utils/migrationUtils';

// Migrate specific users
const result = await migrationUtils.runFullMigration(['admin_example_com']);

// Verify migration
const verification = await migrationUtils.verifyMigration('admin_example_com');
```

### Step 4: Update Components
After migration, ensure all components use the new AuthContext functions. The updated AuthContext provides backward compatibility during transition.

### Step 5: Test Thoroughly
1. Test all CRUD operations (Create, Read, Update, Delete)
2. Verify data integrity in new structure
3. Test user authentication and data isolation
4. Check all features work correctly

### Step 6: Clean Up (After Verification)
Once you've verified everything works correctly, you can remove the old data structure.

## Migration Utilities

### Key Files Created
- `src/utils/migrationUtils.js` - Core migration logic
- `src/scripts/runMigration.js` - Command-line migration script  
- `src/components/admin/MigrationPanel.jsx` - UI for migration
- `MIGRATION_GUIDE.md` - This guide

### Migration Functions
- `migrateUserData(safeEmail)` - Migrate single user
- `runFullMigration(userEmails)` - Migrate multiple users
- `verifyMigration(safeEmail)` - Verify migration success
- `createUserProfile(safeEmail)` - Create user profile document

## Data Mapping

### User Profile (NEW)
```javascript
{
  email: "user@example.com",
  name: "user",  // Extracted from email
  role: "user",
  createdAt: timestamp,
  lastLogin: timestamp,
  migratedAt: timestamp
}
```

### Clients Data
- **Old Path**: `{safeEmail}/user/clients/{clientPAN}`
- **New Path**: `ca_admin/{safeEmail}/clients/{clientPAN}`
- **Data**: Same structure + `migratedAt` timestamp

### Years & Documents
- **Old Path**: `{safeEmail}/user/clients/{clientPAN}/years/{year}/documents/{docId}`
- **New Path**: `ca_admin/{safeEmail}/clients/{clientPAN}/years/{year}/documents/{docId}`
- **Data**: Same structure + `migratedAt` timestamp

### Banners Data
- **Old Path**: `{safeEmail}/user/banners/{bannerName}`
- **New Path**: `ca_admin/{safeEmail}/banners/{bannerName}`
- **Data**: Same structure + `migratedAt` timestamp

### Admin Data
- **Old Path**: `{safeEmail}/user/admin/{adminDoc}`
- **New Path**: `ca_admin/{safeEmail}/admin/{adminDoc}`
- **Data**: Same structure + `migratedAt` timestamp

## Troubleshooting

### Common Issues

#### 1. "No users found to migrate"
- **Cause**: Script can't auto-detect user collections
- **Solution**: Manually specify user emails in the migration script

#### 2. "Permission denied" errors
- **Cause**: Firestore security rules may block migration
- **Solution**: Temporarily update security rules or run as admin

#### 3. "Batch write failed"
- **Cause**: Too many operations in single batch
- **Solution**: Migration utility automatically handles batch limits

#### 4. Components still using old paths
- **Cause**: Components not updated to use new AuthContext functions
- **Solution**: Update components to use new path functions

### Getting User Emails
To find existing user emails in your Firestore:

1. **Firestore Console**: Check for collections matching email patterns
2. **Firebase CLI**: 
```bash
firebase firestore:export --collection-ids=users gs://temp-bucket
```
3. **Manual List**: Create a list of known user emails

### Verification Steps
After migration, verify:
- [ ] User profile created in new location
- [ ] All clients migrated with correct PAN numbers
- [ ] All years and documents preserved
- [ ] Banners migrated correctly
- [ ] Admin data and images preserved
- [ ] All timestamps and metadata intact

## Security Considerations

### Updated Firestore Rules (Recommended)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Supernode structure rules
    match /ca_admin/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && 
        request.auth.token.email.replace('.', '_') == userId;
    }
    
    // Legacy structure (remove after migration)
    match /{userId}/{document=**} {
      allow read, write: if request.auth != null && 
        request.auth.token.email.replace('.', '_') == userId;
    }
  }
}
```

## Rollback Plan

If you need to rollback:

1. **Stop using new structure**: Revert AuthContext to use legacy functions
2. **Keep old data**: Don't delete original data until fully verified
3. **Restore from backup**: Use Firebase backup if needed

## Support

If you encounter issues:

1. Check the migration logs for detailed error messages
2. Verify your Firestore security rules
3. Ensure proper authentication
4. Test with a single user first before batch migration

## Next Steps After Migration

1. **Update Security Rules**: Implement new rules for supernode structure
2. **Add Organization Features**: Leverage the new structure for admin features
3. **Monitor Performance**: Check if the new structure improves query performance
4. **Clean Up**: Remove old data structure after thorough testing
5. **Documentation**: Update your team documentation with new structure

---

**⚠️ Important Reminders:**
- Always backup before migration
- Test thoroughly before going live
- Keep old data until fully verified
- Update all team members about the new structure
