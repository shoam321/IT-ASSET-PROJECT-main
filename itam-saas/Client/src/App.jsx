import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Search, Trash2, Edit2, Menu, X, HardDrive, FileText, Users, FileCheck } from 'lucide-react';
import * as dbService from './services/db';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('assets');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [assets, setAssets] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  
  // Prevent duplicate submissions
  const isSubmittingRef = useRef(false);
  const [formData, setFormData] = useState({
    asset_tag: '',
    asset_type: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    assigned_user_name: '',
    status: 'In Use'
  });
  const [licenseFormData, setLicenseFormData] = useState({
    license_name: '',
    license_type: '',
    license_key: '',
    software_name: '',
    vendor: '',
    expiration_date: '',
    quantity: 1,
    status: 'Active',
    cost: 0,
    notes: ''
  });
  const [userFormData, setUserFormData] = useState({
    user_name: '',
    email: '',
    department: '',
    phone: '',
    role: '',
    status: 'Active',
    notes: ''
  });
  const [contractFormData, setContractFormData] = useState({
    contract_name: '',
    vendor: '',
    contract_type: '',
    start_date: '',
    end_date: '',
    value: 0,
    currency: 'USD',
    status: 'Active',
    description: ''
  });

  useEffect(() => {
    loadAssets();
    loadLicenses();
    loadUsers();
    loadContracts();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dbService.fetchAssets();
      // Remove duplicates by ID
      const uniqueAssets = Array.from(new Map(data.map(item => [item.id, item])).values());
      setAssets(uniqueAssets);
    } catch (err) {
      console.error('Failed to load assets:', err);
      setError('Failed to load assets. Make sure the backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const loadLicenses = async () => {
    try {
      const data = await dbService.fetchLicenses();
      // Remove duplicates by ID
      const uniqueLicenses = Array.from(new Map(data.map(item => [item.id, item])).values());
      setLicenses(uniqueLicenses);
    } catch (err) {
      console.error('Failed to load licenses:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await dbService.fetchUsers();
      // Remove duplicates by ID
      const uniqueUsers = Array.from(new Map(data.map(item => [item.id, item])).values());
      setUsers(uniqueUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadContracts = async () => {
    try {
      const data = await dbService.fetchContracts();
      // Remove duplicates by ID
      const uniqueContracts = Array.from(new Map(data.map(item => [item.id, item])).values());
      setContracts(uniqueContracts);
    } catch (err) {
      console.error('Failed to load contracts:', err);
    }
  };

  const handleAddAsset = async () => {
    if (isSubmittingRef.current) {
      console.warn('Submission already in progress');
      return;
    }
    
    if (!formData.asset_tag.trim()) {
      alert('Please enter an asset tag');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);
      if (editingId) {
        await dbService.updateAsset(editingId, formData);
        setEditingId(null);
      } else {
        await dbService.createAsset(formData);
      }
      setFormData({
        asset_tag: '',
        asset_type: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        assigned_user_name: '',
        status: 'In Use'
      });
      setShowForm(false);
      await loadAssets();
    } catch (err) {
      setError(`Failed to ${editingId ? 'update' : 'add'} asset: ${err.message}`);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleEditAsset = (asset) => {
    setEditingId(asset.id);
    setFormData({
      asset_tag: asset.asset_tag,
      asset_type: asset.asset_type,
      manufacturer: asset.manufacturer,
      model: asset.model,
      serial_number: asset.serial_number,
      assigned_user_name: asset.assigned_user_name,
      status: asset.status
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    setFormData({
      asset_tag: '',
      asset_type: '',
      manufacturer: '',
      model: '',
      serial_number: '',
      assigned_user_name: '',
      status: 'In Use'
    });
  };

  const handleDeleteAsset = async (id) => {
    try {
      setLoading(true);
      await dbService.deleteAsset(id);
      await loadAssets();
    } catch (err) {
      setError(`Failed to delete asset: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // License handlers
  const handleAddLicense = async () => {
    if (isSubmittingRef.current) {
      console.warn('Submission already in progress');
      return;
    }
    
    if (!licenseFormData.license_name.trim()) {
      alert('Please enter a license name');
      return;
    }
    if (!licenseFormData.license_type.trim()) {
      alert('Please select a license type');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);
      // Format expiration_date from ISO to yyyy-MM-dd
      let formattedDate = licenseFormData.expiration_date;
      if (formattedDate) {
        // If it's an ISO date (contains T), extract just the date part
        if (formattedDate.includes('T')) {
          formattedDate = formattedDate.split('T')[0];
        }
        // If it's in dd/mm/yyyy format, convert to yyyy-MM-dd
        else if (formattedDate.includes('/')) {
          const parts = formattedDate.split('/');
          if (parts.length === 3) {
            formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
      }
      
      const dataToSend = {
        ...licenseFormData,
        license_name: licenseFormData.license_name.trim(),
        license_type: licenseFormData.license_type.trim(),
        software_name: licenseFormData.software_name?.trim() || null,
        vendor: licenseFormData.vendor?.trim() || null,
        expiration_date: formattedDate || null,
        quantity: parseInt(licenseFormData.quantity) || 1,
        cost: parseFloat(licenseFormData.cost) || 0,
        notes: licenseFormData.notes?.trim() || null
      };
      
      if (editingId) {
        await dbService.updateLicense(editingId, dataToSend);
        setEditingId(null);
      } else {
        await dbService.createLicense(dataToSend);
      }
      setLicenseFormData({
        license_name: '',
        license_type: '',
        license_key: '',
        software_name: '',
        vendor: '',
        expiration_date: '',
        quantity: 1,
        status: 'Active',
        cost: 0,
        notes: ''
      });
      setShowForm(false);
      await loadLicenses();
    } catch (err) {
      setError(`Failed to ${editingId ? 'update' : 'add'} license: ${err.message}`);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleEditLicense = (license) => {
    setEditingId(license.id);
    setLicenseFormData(license);
    setShowForm(true);
  };

  const handleDeleteLicense = async (id) => {
    try {
      setLoading(true);
      await dbService.deleteLicense(id);
      await loadLicenses();
    } catch (err) {
      setError(`Failed to delete license: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // User handlers
  const handleAddUser = async () => {
    if (isSubmittingRef.current) {
      console.warn('Submission already in progress');
      return;
    }
    
    if (!userFormData.user_name.trim()) {
      alert('Please enter a user name');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);
      if (editingId) {
        await dbService.updateUser(editingId, userFormData);
        setEditingId(null);
      } else {
        await dbService.createUser(userFormData);
      }
      setUserFormData({
        user_name: '',
        email: '',
        department: '',
        phone: '',
        role: '',
        status: 'Active',
        notes: ''
      });
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setError(`Failed to ${editingId ? 'update' : 'add'} user: ${err.message}`);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setEditingId(user.id);
    setUserFormData(user);
    setShowForm(true);
  };

  const handleDeleteUser = async (id) => {
    try {
      setLoading(true);
      await dbService.deleteUser(id);
      await loadUsers();
    } catch (err) {
      setError(`Failed to delete user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Contract handlers
  const handleAddContract = async () => {
    if (isSubmittingRef.current) {
      console.warn('Submission already in progress');
      return;
    }
    
    if (!contractFormData.contract_name.trim()) {
      alert('Please enter a contract name');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);
      if (editingId) {
        await dbService.updateContract(editingId, contractFormData);
        setEditingId(null);
      } else {
        await dbService.createContract(contractFormData);
      }
      setContractFormData({
        contract_name: '',
        vendor: '',
        contract_type: '',
        start_date: '',
        end_date: '',
        value: 0,
        currency: 'USD',
        status: 'Active',
        description: ''
      });
      setShowForm(false);
      await loadContracts();
    } catch (err) {
      setError(`Failed to ${editingId ? 'update' : 'add'} contract: ${err.message}`);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleEditContract = (contract) => {
    setEditingId(contract.id);
    setContractFormData(contract);
    setShowForm(true);
  };

  const handleDeleteContract = async (id) => {
    try {
      setLoading(true);
      await dbService.deleteContract(id);
      await loadContracts();
    } catch (err) {
      setError(`Failed to delete contract: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = searchTerm 
    ? assets.filter(asset =>
        asset.asset_tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.model.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : assets;

  // Screen rendering functions
  const renderAssetsScreen = () => (
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

      {loading && (
        <div className="mb-6 p-4 bg-blue-900 border border-blue-700 rounded-lg">
          <p className="text-blue-200">Loading...</p>
        </div>
      )}

      {showForm && (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 mb-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4">{editingId ? 'Edit Asset' : 'Add New Asset'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Asset Tag"
              value={formData.asset_tag}
              onChange={(e) => setFormData({...formData, asset_tag: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <select
              value={formData.asset_type}
              onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            >
              <option value="">Select Type</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="cloud">Cloud</option>
              <option value="network">Network</option>
            </select>
            <input
              type="text"
              placeholder="Manufacturer"
              value={formData.manufacturer}
              onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="Model"
              value={formData.model}
              onChange={(e) => setFormData({...formData, model: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="Serial Number"
              value={formData.serial_number}
              onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="email"
              placeholder="Assigned User"
              value={formData.assigned_user_name}
              onChange={(e) => setFormData({...formData, assigned_user_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddAsset}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition"
            >
              {editingId ? 'Update Device' : 'Save Device'}
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                setShowForm(false);
                setFormData({
                  asset_tag: '',
                  asset_type: '',
                  manufacturer: '',
                  model: '',
                  serial_number: '',
                  assigned_user_name: '',
                  status: 'In Use'
                });
              }}
              className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 border-b border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Asset Tag</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Type</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Manufacturer</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Model</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Assigned User</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                    No assets found
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="border-b border-slate-600 hover:bg-slate-600 transition">
                    <td className="px-6 py-4 text-white font-medium">{asset.asset_tag}</td>
                    <td className="px-6 py-4 text-slate-300">
                      <span className="bg-blue-900 text-blue-200 px-2 py-1 rounded text-xs">
                        {asset.asset_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{asset.manufacturer}</td>
                    <td className="px-6 py-4 text-slate-300">{asset.model}</td>
                    <td className="px-6 py-4 text-slate-300">{asset.assigned_user_name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        asset.status === 'In Use' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditAsset(asset)}
                          className="text-blue-400 hover:text-blue-300 transition">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Total Assets</p>
          <p className="text-3xl font-bold text-white mt-2">{assets.length}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">In Use</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{assets.filter(a => a.status === 'In Use').length}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Connected to PostgreSQL</p>
          <p className="text-3xl font-bold text-purple-400 mt-2">✓</p>
        </div>
      </div>
    </>
  );

  const renderLicensesScreen = () => (
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

      {loading && (
        <div className="mb-6 p-4 bg-blue-900 border border-blue-700 rounded-lg">
          <p className="text-blue-200">Loading...</p>
        </div>
      )}

      {showForm && (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 mb-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4">{editingId ? 'Edit License' : 'Add New License'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="License Name"
              value={licenseFormData.license_name}
              onChange={(e) => setLicenseFormData({...licenseFormData, license_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="License Type"
              value={licenseFormData.license_type}
              onChange={(e) => setLicenseFormData({...licenseFormData, license_type: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="License Key"
              value={licenseFormData.license_key}
              onChange={(e) => setLicenseFormData({...licenseFormData, license_key: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="Software Name"
              value={licenseFormData.software_name}
              onChange={(e) => setLicenseFormData({...licenseFormData, software_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="Vendor"
              value={licenseFormData.vendor}
              onChange={(e) => setLicenseFormData({...licenseFormData, vendor: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="date"
              placeholder="Expiration Date"
              value={licenseFormData.expiration_date}
              onChange={(e) => setLicenseFormData({...licenseFormData, expiration_date: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="number"
              placeholder="Quantity"
              value={licenseFormData.quantity}
              onChange={(e) => setLicenseFormData({...licenseFormData, quantity: parseInt(e.target.value)})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <select
              value={licenseFormData.status}
              onChange={(e) => setLicenseFormData({...licenseFormData, status: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            >
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddLicense}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition"
            >
              {editingId ? 'Update License' : 'Save License'}
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                setShowForm(false);
                setLicenseFormData({
                  license_name: '',
                  license_type: '',
                  license_key: '',
                  software_name: '',
                  vendor: '',
                  expiration_date: '',
                  quantity: 1,
                  status: 'Active',
                  cost: 0,
                  notes: ''
                });
              }}
              className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search licenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 border-b border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">License Name</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Software</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Vendor</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Expiration Date</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {licenses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                    No licenses found
                  </td>
                </tr>
              ) : (
                licenses.filter(lic => searchTerm ? lic.license_name.toLowerCase().includes(searchTerm.toLowerCase()) || lic.software_name?.toLowerCase().includes(searchTerm.toLowerCase()) : true).map((license) => (
                  <tr key={license.id} className="border-b border-slate-600 hover:bg-slate-600 transition">
                    <td className="px-6 py-4 text-white font-medium">{license.license_name}</td>
                    <td className="px-6 py-4 text-slate-300">{license.software_name}</td>
                    <td className="px-6 py-4 text-slate-300">{license.vendor}</td>
                    <td className="px-6 py-4 text-slate-300">{license.expiration_date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        license.status === 'Active' ? 'bg-green-900 text-green-200' : license.status === 'Expired' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'
                      }`}>
                        {license.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditLicense(license)}
                          className="text-blue-400 hover:text-blue-300 transition">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLicense(license.id)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Total Licenses</p>
          <p className="text-3xl font-bold text-white mt-2">{licenses.length}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Active</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{licenses.filter(l => l.status === 'Active').length}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Expired</p>
          <p className="text-3xl font-bold text-red-400 mt-2">{licenses.filter(l => l.status === 'Expired').length}</p>
        </div>
      </div>
    </>
  );

  const renderUsersScreen = () => (
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

      {loading && (
        <div className="mb-6 p-4 bg-blue-900 border border-blue-700 rounded-lg">
          <p className="text-blue-200">Loading...</p>
        </div>
      )}

      {showForm && (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 mb-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4">{editingId ? 'Edit User' : 'Add New User'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="User Name"
              value={userFormData.user_name}
              onChange={(e) => setUserFormData({...userFormData, user_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="email"
              placeholder="Email"
              value={userFormData.email}
              onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="Department"
              value={userFormData.department}
              onChange={(e) => setUserFormData({...userFormData, department: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={userFormData.phone}
              onChange={(e) => setUserFormData({...userFormData, phone: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="Role"
              value={userFormData.role}
              onChange={(e) => setUserFormData({...userFormData, role: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <select
              value={userFormData.status}
              onChange={(e) => setUserFormData({...userFormData, status: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddUser}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition"
            >
              {editingId ? 'Update User' : 'Save User'}
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                setShowForm(false);
                setUserFormData({
                  user_name: '',
                  email: '',
                  department: '',
                  phone: '',
                  role: '',
                  status: 'Active',
                  notes: ''
                });
              }}
              className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 border-b border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">User Name</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Email</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Department</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Phone</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.filter(user => searchTerm ? user.user_name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email?.toLowerCase().includes(searchTerm.toLowerCase()) : true).map((user) => (
                  <tr key={user.id} className="border-b border-slate-600 hover:bg-slate-600 transition">
                    <td className="px-6 py-4 text-white font-medium">{user.user_name}</td>
                    <td className="px-6 py-4 text-slate-300">{user.email}</td>
                    <td className="px-6 py-4 text-slate-300">{user.department}</td>
                    <td className="px-6 py-4 text-slate-300">{user.phone}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.status === 'Active' ? 'bg-green-900 text-green-200' : user.status === 'Suspended' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="text-blue-400 hover:text-blue-300 transition">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Total Users</p>
          <p className="text-3xl font-bold text-white mt-2">{users.length}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Active</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{users.filter(u => u.status === 'Active').length}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Inactive</p>
          <p className="text-3xl font-bold text-red-400 mt-2">{users.filter(u => u.status === 'Inactive').length}</p>
        </div>
      </div>
    </>
  );

  const renderContractsScreen = () => (
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

      {loading && (
        <div className="mb-6 p-4 bg-blue-900 border border-blue-700 rounded-lg">
          <p className="text-blue-200">Loading...</p>
        </div>
      )}

      {showForm && (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 mb-8 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4">{editingId ? 'Edit Contract' : 'Add New Contract'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Contract Name"
              value={contractFormData.contract_name}
              onChange={(e) => setContractFormData({...contractFormData, contract_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="Vendor"
              value={contractFormData.vendor}
              onChange={(e) => setContractFormData({...contractFormData, vendor: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <select
              value={contractFormData.contract_type}
              onChange={(e) => setContractFormData({...contractFormData, contract_type: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            >
              <option value="">Select Contract Type</option>
              <option value="Service">Service</option>
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Support">Support</option>
            </select>
            <input
              type="date"
              placeholder="Start Date"
              value={contractFormData.start_date}
              onChange={(e) => setContractFormData({...contractFormData, start_date: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              type="date"
              placeholder="End Date"
              value={contractFormData.end_date}
              onChange={(e) => setContractFormData({...contractFormData, end_date: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Value"
                value={contractFormData.value}
                onChange={(e) => setContractFormData({...contractFormData, value: parseFloat(e.target.value)})}
                className="flex-1 px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
              <select
                value={contractFormData.currency}
                onChange={(e) => setContractFormData({...contractFormData, currency: e.target.value})}
                className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white w-24"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="ILS">ILS</option>
              </select>
            </div>
            <select
              value={contractFormData.status}
              onChange={(e) => setContractFormData({...contractFormData, status: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            >
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
            </select>
            <textarea
              placeholder="Description"
              value={contractFormData.description}
              onChange={(e) => setContractFormData({...contractFormData, description: e.target.value})}
              className="col-span-2 px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 h-20"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddContract}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition"
            >
              {editingId ? 'Update Contract' : 'Save Contract'}
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                setShowForm(false);
                setContractFormData({
                  contract_name: '',
                  vendor: '',
                  contract_type: '',
                  start_date: '',
                  end_date: '',
                  value: 0,
                  currency: 'USD',
                  status: 'Active',
                  description: ''
                });
              }}
              className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 border-b border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Contract Name</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Vendor</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Type</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Start Date</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">End Date</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Value</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                    No contracts found
                  </td>
                </tr>
              ) : (
                contracts.filter(contract => searchTerm ? contract.contract_name.toLowerCase().includes(searchTerm.toLowerCase()) || contract.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) : true).map((contract) => (
                  <tr key={contract.id} className="border-b border-slate-600 hover:bg-slate-600 transition">
                    <td className="px-6 py-4 text-white font-medium">{contract.contract_name}</td>
                    <td className="px-6 py-4 text-slate-300">{contract.vendor}</td>
                    <td className="px-6 py-4 text-slate-300">
                      <span className="bg-purple-900 text-purple-200 px-2 py-1 rounded text-xs">
                        {contract.contract_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{contract.start_date}</td>
                    <td className="px-6 py-4 text-slate-300">{contract.end_date}</td>
                    <td className="px-6 py-4 text-slate-300">{contract.value} {contract.currency}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        contract.status === 'Active' ? 'bg-green-900 text-green-200' : contract.status === 'Expired' ? 'bg-red-900 text-red-200' : contract.status === 'Pending' ? 'bg-yellow-900 text-yellow-200' : 'bg-slate-900 text-slate-200'
                      }`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditContract(contract)}
                          className="text-blue-400 hover:text-blue-300 transition">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContract(contract.id)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Total Contracts</p>
          <p className="text-3xl font-bold text-white mt-2">{contracts.length}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Active</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{contracts.filter(c => c.status === 'Active').length}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Total Value</p>
          <p className="text-3xl font-bold text-blue-400 mt-2">{contracts.reduce((sum, c) => sum + (c.value || 0), 0).toLocaleString()}</p>
        </div>
      </div>
    </>
  );

  const renderScreen = () => {
    switch(currentScreen) {
      case 'assets':
        return renderAssetsScreen();
      case 'licenses':
        return renderLicensesScreen();
      case 'users':
        return renderUsersScreen();
      case 'contracts':
        return renderContractsScreen();
      default:
        return renderAssetsScreen();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-slate-800 border-r border-slate-700 transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Package className="w-8 h-8 text-blue-500" />
            <span className="text-xl font-bold text-white">IT ASSET</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => { setCurrentScreen('assets'); setShowForm(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              currentScreen === 'assets' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <HardDrive className="w-5 h-5" />
            <span>Assets</span>
          </button>

          <button
            onClick={() => { setCurrentScreen('licenses'); setShowForm(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              currentScreen === 'licenses' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Licenses</span>
          </button>

          <button
            onClick={() => { setCurrentScreen('users'); setShowForm(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              currentScreen === 'users' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Users</span>
          </button>

          <button
            onClick={() => { setCurrentScreen('contracts'); setShowForm(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              currentScreen === 'contracts' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <FileCheck className="w-5 h-5" />
            <span>Contracts</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 shadow-lg">
          <div className="px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-300"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            {currentScreen === 'assets' && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Plus className="w-5 h-5" />
                Add Asset
              </button>
            )}
            
            {currentScreen === 'licenses' && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Plus className="w-5 h-5" />
                Add License
              </button>
            )}
            
            {currentScreen === 'users' && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Plus className="w-5 h-5" />
                Add User
              </button>
            )}
            
            {currentScreen === 'contracts' && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Plus className="w-5 h-5" />
                Add Contract
              </button>
            )}
          </div>
        </header>

        {/* Screen Content */}
        <main className="flex-1 overflow-auto p-8">
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}
