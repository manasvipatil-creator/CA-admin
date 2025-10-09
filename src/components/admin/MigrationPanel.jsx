// src/components/admin/MigrationPanel.jsx
import React, { useState } from 'react';
import { migrationUtils, verifyUserMigration } from '../../utils/migrationUtils';
import { useAuth } from '../../contexts/AuthContext';

const MigrationPanel = () => {
  const { userEmail, getSafeEmail } = useAuth();
  const [migrationStatus, setMigrationStatus] = useState('idle'); // idle, running, completed, error
  const [migrationResults, setMigrationResults] = useState(null);
  const [verificationResults, setVerificationResults] = useState(null);
  const [customEmails, setCustomEmails] = useState('');
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const newLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    setLogs(prev => [...prev, newLog]);
  };

  const runMigrationForCurrentUser = async () => {
    if (!userEmail) {
      addLog('No user logged in', 'error');
      return;
    }

    setMigrationStatus('running');
    setLogs([]);
    addLog('Starting migration for current user...');

    try {
      const safeEmail = getSafeEmail(userEmail);
      const result = await migrationUtils.migrateUserData(safeEmail);
      
      if (result.success) {
        addLog(`Migration completed successfully! Migrated ${result.operationCount} documents.`, 'success');
        setMigrationResults(result);
        
        // Run verification
        addLog('Running verification...');
        const verification = await verifyUserMigration(safeEmail);
        setVerificationResults(verification);
        addLog('Verification completed', 'success');
        
        setMigrationStatus('completed');
      } else {
        addLog(`Migration failed: ${result.error}`, 'error');
        setMigrationStatus('error');
      }
    } catch (error) {
      addLog(`Migration error: ${error.message}`, 'error');
      setMigrationStatus('error');
    }
  };

  const runMigrationForCustomUsers = async () => {
    if (!customEmails.trim()) {
      addLog('Please enter user emails', 'error');
      return;
    }

    setMigrationStatus('running');
    setLogs([]);
    addLog('Starting migration for custom users...');

    try {
      const emailList = customEmails
        .split('\n')
        .map(email => email.trim())
        .filter(email => email.length > 0)
        .map(email => email.replace(/\./g, '_')); // Convert to safe email format

      addLog(`Migrating ${emailList.length} users...`);
      
      const result = await migrationUtils.runFullMigration(emailList);
      
      if (result.success) {
        addLog(`Migration completed successfully!`, 'success');
        addLog(`Total: ${result.summary.total}, Successful: ${result.summary.successful}, Failed: ${result.summary.failed}`, 'info');
        setMigrationResults(result);
        setMigrationStatus('completed');
      } else {
        addLog(`Migration completed with errors`, 'warning');
        setMigrationResults(result);
        setMigrationStatus('error');
      }
    } catch (error) {
      addLog(`Migration error: ${error.message}`, 'error');
      setMigrationStatus('error');
    }
  };

  const verifyCurrentUser = async () => {
    if (!userEmail) {
      addLog('No user logged in', 'error');
      return;
    }

    addLog('Running verification for current user...');
    
    try {
      const safeEmail = getSafeEmail(userEmail);
      const verification = await verifyUserMigration(safeEmail);
      setVerificationResults(verification);
      
      if (verification.error) {
        addLog(`Verification failed: ${verification.error}`, 'error');
      } else {
        addLog(`Verification completed: Profile=${verification.profile}, Clients=${verification.clients}, Banners=${verification.banners}, Admin=${verification.admin}`, 'success');
      }
    } catch (error) {
      addLog(`Verification error: ${error.message}`, 'error');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setMigrationResults(null);
    setVerificationResults(null);
    setMigrationStatus('idle');
  };

  const getStatusColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = () => {
    switch (migrationStatus) {
      case 'running': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">Running...</span>;
      case 'completed': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Completed</span>;
      case 'error': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">Error</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">Ready</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">🚀 Supernode Migration Panel</h2>
        <p className="text-gray-600">
          Migrate your data from the old structure to the new supernode structure: <code className="bg-gray-100 px-2 py-1 rounded">ca_admin/users/{'{userEmail}'}</code>
        </p>
        <div className="mt-2">
          Status: {getStatusBadge()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Migration Controls */}
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">Current User Migration</h3>
            <p className="text-sm text-blue-600 mb-3">
              Migrate data for the currently logged-in user: <strong>{userEmail}</strong>
            </p>
            <div className="space-y-2">
              <button
                onClick={runMigrationForCurrentUser}
                disabled={migrationStatus === 'running' || !userEmail}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {migrationStatus === 'running' ? 'Migrating...' : 'Migrate Current User'}
              </button>
              <button
                onClick={verifyCurrentUser}
                disabled={!userEmail}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Verify Current User
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-800 mb-3">Batch Migration</h3>
            <p className="text-sm text-yellow-600 mb-3">
              Migrate multiple users by entering their emails (one per line):
            </p>
            <textarea
              value={customEmails}
              onChange={(e) => setCustomEmails(e.target.value)}
              placeholder="user1@example.com&#10;user2@example.com&#10;admin@company.com"
              className="w-full h-24 p-2 border border-yellow-300 rounded text-sm"
              disabled={migrationStatus === 'running'}
            />
            <button
              onClick={runMigrationForCustomUsers}
              disabled={migrationStatus === 'running' || !customEmails.trim()}
              className="w-full mt-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {migrationStatus === 'running' ? 'Migrating...' : 'Migrate Custom Users'}
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Controls</h3>
            <button
              onClick={clearLogs}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Results and Logs */}
        <div className="space-y-4">
          {/* Migration Results */}
          {migrationResults && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Migration Results</h3>
              {migrationResults.summary && (
                <div className="text-sm space-y-1">
                  <p><strong>Total Users:</strong> {migrationResults.summary.total}</p>
                  <p><strong>Successful:</strong> {migrationResults.summary.successful}</p>
                  <p><strong>Failed:</strong> {migrationResults.summary.failed}</p>
                </div>
              )}
              {migrationResults.operationCount && (
                <p className="text-sm"><strong>Documents Migrated:</strong> {migrationResults.operationCount}</p>
              )}
            </div>
          )}

          {/* Verification Results */}
          {verificationResults && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-3">Verification Results</h3>
              <div className="text-sm space-y-1">
                <p><strong>User:</strong> {verificationResults.user}</p>
                <p><strong>Profile:</strong> {verificationResults.profile ? '✅' : '❌'}</p>
                <p><strong>Clients:</strong> {verificationResults.clients}</p>
                <p><strong>Banners:</strong> {verificationResults.banners}</p>
                <p><strong>Admin Documents:</strong> {verificationResults.admin}</p>
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Migration Logs</h3>
            <div className="h-64 overflow-y-auto bg-white p-3 rounded border text-sm font-mono">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet. Run a migration to see logs here.</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={`mb-1 ${getStatusColor(log.type)}`}>
                    <span className="text-gray-400">[{log.timestamp}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="mt-6 bg-red-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 mb-2">⚠️ Important Notes</h3>
        <ul className="text-sm text-red-700 space-y-1">
          <li>• <strong>Backup your data</strong> before running migration</li>
          <li>• Migration will create new documents in the supernode structure</li>
          <li>• Original data will remain untouched (you can delete it later)</li>
          <li>• Test thoroughly after migration before removing old data</li>
          <li>• All components will need to use the new AuthContext functions</li>
        </ul>
      </div>
    </div>
  );
};

export default MigrationPanel;
