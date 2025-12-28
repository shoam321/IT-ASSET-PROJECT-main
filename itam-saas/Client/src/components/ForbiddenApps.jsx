import React, { useState, useEffect } from 'react';
import { Plus, X, Trash2, Search, Edit2, Check, XCircle } from 'lucide-react';
import InfoButton from './InfoButton';

const ForbiddenApps = () => {
  const [forbiddenApps, setForbiddenApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingApp, setEditingApp] = useState(null);
  const [newApp, setNewApp] = useState({
    process_name: '',
    description: '',
    severity: 'Medium'
  });
  const [filter, setFilter] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app';

  useEffect(() => {
    fetchForbiddenApps();
  }, []);

  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const fetchForbiddenApps = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/forbidden-apps`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch forbidden apps');

      const data = await response.json();
      setForbiddenApps(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAddApp = async (e) => {
    e.preventDefault();
    
    if (!newApp.process_name.trim()) {
      setError('Process name is required');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/forbidden-apps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newApp,
          process_name: newApp.process_name.trim().toLowerCase()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add forbidden app');
      }

      const added = await response.json();
      setForbiddenApps([added, ...forbiddenApps]);
      setNewApp({ process_name: '', description: '', severity: 'Medium' });
      setShowForm(false);
      showSuccessMessage(`Successfully added "${added.process_name}"`);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApp = async (id, processName) => {
    if (!window.confirm(`Delete "${processName}" from forbidden list?`)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/forbidden-apps/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete forbidden app');

      setForbiddenApps(forbiddenApps.filter(app => app.id !== id));
      showSuccessMessage(`Removed "${processName}"`);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateApp = async (id) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/forbidden-apps/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          process_name: editingApp.process_name.trim().toLowerCase(),
          description: editingApp.description,
          severity: editingApp.severity
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update forbidden app');
      }

      const updated = await response.json();
      setForbiddenApps(forbiddenApps.map(app => app.id === id ? updated : app));
      setEditingApp(null);
      showSuccessMessage(`Updated "${updated.process_name}"`);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (app) => {
    setEditingApp({ ...app });
  };

  const cancelEditing = () => {
    setEditingApp(null);
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'Low': 'bg-green-900 text-green-200',
      'Medium': 'bg-yellow-900 text-yellow-200',
      'High': 'bg-orange-900 text-orange-200',
      'Critical': 'bg-red-900 text-red-200'
    };
    return colors[severity] || 'bg-slate-600 text-slate-300';
  };

  const filteredApps = forbiddenApps.filter(app =>
    searchTerm ? 
      app.process_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.description && app.description.toLowerCase().includes(searchTerm.toLowerCase()))
    : true
  ).filter(app => 
    filter ? app.process_name === filter : true
  );

  return (
    <>
      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-200">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-sm mt-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-900 border border-green-700 rounded-lg">
          <p className="text-green-200">{successMessage}</p>
        </div>
      )}

      {loading && (
        <div className="mb-6 p-4 bg-blue-900 border border-blue-700 rounded-lg">
          <p className="text-blue-200">Loading...</p>
        </div>
      )}

      <div className="mb-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h1 className="text-3xl font-bold text-white m-0">🚫 Forbidden Apps</h1>
          <InfoButton
            title="Forbidden Apps Monitor"
            description="Protect your organization by defining which applications are not allowed to run. The system automatically detects when forbidden apps are launched and creates security alerts to help you respond quickly."
            examples={[
              "Block unauthorized or dangerous software (malware, hacking tools)",
              "Prevent use of personal apps that violate company policy",
              "Get instant alerts when forbidden apps are detected",
              "Set severity levels (Low, Medium, High, Critical) for different apps",
              "Track which users attempted to run forbidden software"
            ]}
          />
        </div>
        <p className="text-slate-400">Define and monitor forbidden applications across your organization</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search forbidden apps..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
          />
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition whitespace-nowrap"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Forbidden App'}
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 mb-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4">Add New Forbidden App</h2>
          <form onSubmit={handleAddApp}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Process Name (e.g., poker.exe)"
                value={newApp.process_name}
                onChange={(e) => setNewApp({ ...newApp, process_name: e.target.value })}
                className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
                required
              />
              <select
                value={newApp.severity}
                onChange={(e) => setNewApp({ ...newApp, severity: e.target.value })}
                className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="mt-4">
              <textarea
                placeholder="Description (optional)"
                value={newApp.description}
                onChange={(e) => setNewApp({ ...newApp, description: e.target.value })}
                rows="3"
                className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition disabled:opacity-50"
            >
              Add Forbidden App
            </button>
          </form>
        </div>
      )}

      <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 border-b border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Process Name</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Description</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Severity</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Added By</th> {/* New column */}
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                    No forbidden apps found
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.id} className="border-b border-slate-600 hover:bg-slate-600 transition">
                    {editingApp && editingApp.id === app.id ? (
                      // Edit mode
                      <>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editingApp.process_name}
                            onChange={(e) => setEditingApp({ ...editingApp, process_name: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-500 rounded text-white font-mono text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editingApp.description || ''}
                            onChange={(e) => setEditingApp({ ...editingApp, description: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-500 rounded text-white text-sm"
                            placeholder="Description"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={editingApp.severity}
                            onChange={(e) => setEditingApp({ ...editingApp, severity: e.target.value })}
                            className="px-2 py-1 bg-slate-700 border border-slate-500 rounded text-white text-sm"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-slate-300 text-sm">
                          {new Date(app.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateApp(app.id)}
                              className="text-green-400 hover:text-green-300 transition"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="text-slate-400 hover:text-slate-300 transition"
                              title="Cancel"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View mode
                      <>
                        <td className="px-6 py-4 text-white font-medium font-mono">{app.process_name}</td>
                        <td className="px-6 py-4 text-slate-300">{app.description || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(app.severity)}`}>
                            {app.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {new Date(app.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditing(app)}
                              className="text-blue-400 hover:text-blue-300 transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteApp(app.id, app.process_name)}
                              className="text-red-400 hover:text-red-300 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Total Apps</p>
          <p className="text-3xl font-bold text-white mt-2">{forbiddenApps.length}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Critical</p>
          <p className="text-3xl font-bold text-red-400 mt-2">
            {forbiddenApps.filter(a => a.severity === 'Critical').length}
          </p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">High</p>
          <p className="text-3xl font-bold text-orange-400 mt-2">
            {forbiddenApps.filter(a => a.severity === 'High').length}
          </p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Medium</p>
          <p className="text-3xl font-bold text-yellow-400 mt-2">
            {forbiddenApps.filter(a => a.severity === 'Medium').length}
          </p>
        </div>
      </div>
    </>
  );
};

export default ForbiddenApps;
