import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Trash2, Edit2, Menu, X, HardDrive, FileText, Users, FileCheck, HelpCircle, CheckCircle, LogOut, Activity, Shield, AlertTriangle, Network, Download, QrCode, Camera, Receipt, Boxes, BarChart3, CreditCard, Zap, Clock } from 'lucide-react';
import * as dbService from './services/db';
import { ASSET_CATEGORIES, getCategoryById, getCategoryColorClasses } from './config/assetCategories';
import { useAuth } from './context/AuthContext';
import UsageMonitor from './components/UsageMonitor';
import ForbiddenApps from './components/ForbiddenApps';
import AlertHistory from './components/AlertHistory';
import NetworkTopology from './components/NetworkTopology';
import AuditTrail from './components/AuditTrail';
import DigitalReceipts from './components/DigitalReceipts';
import ReceiptsView from './components/ReceiptsView';
import GrafanaDashboards from './components/GrafanaDashboards';
import AssetScanner from './components/AssetScanner';
import QRCodeGenerator from './components/QRCodeGenerator';
import StockOverview from './components/StockOverview';
import Consumables from './components/Consumables';
import CategoryIcon from './components/CategoryIcon';
import Billing from './components/Billing';
import { downloadCsv } from './utils/csvExport';

// Helper function to format dates in a user-friendly way
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Helper function to format currency
const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Recent asset marker (first 24h)
const isRecentlyCreated = (createdAt) => {
  if (!createdAt) return false;
  const ts = new Date(createdAt).getTime();
  if (Number.isNaN(ts)) return false;
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Date.now() - ts < oneDayMs;
};

export default function App() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [currentScreen, setCurrentScreen] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [assets, setAssets] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [universalSearch, setUniversalSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [selectedAssetForQR, setSelectedAssetForQR] = useState(null);
  
  // Prevent duplicate submissions
  const isSubmittingRef = useRef(false);
  const [formData, setFormData] = useState({
    asset_tag: '',
    asset_type: '',
    category: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    assigned_user_name: '',
    status: 'In Use',
    cost: 0
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

  const COUNTRY_DIAL_CODES = [
    { code: '+1', label: 'United States/Canada (+1)' },
    { code: '+7', label: 'Russia/Kazakhstan (+7)' },
    { code: '+20', label: 'Egypt (+20)' },
    { code: '+27', label: 'South Africa (+27)' },
    { code: '+30', label: 'Greece (+30)' },
    { code: '+31', label: 'Netherlands (+31)' },
    { code: '+32', label: 'Belgium (+32)' },
    { code: '+33', label: 'France (+33)' },
    { code: '+34', label: 'Spain (+34)' },
    { code: '+36', label: 'Hungary (+36)' },
    { code: '+39', label: 'Italy (+39)' },
    { code: '+40', label: 'Romania (+40)' },
    { code: '+41', label: 'Switzerland (+41)' },
    { code: '+43', label: 'Austria (+43)' },
    { code: '+44', label: 'United Kingdom (+44)' },
    { code: '+45', label: 'Denmark (+45)' },
    { code: '+46', label: 'Sweden (+46)' },
    { code: '+47', label: 'Norway (+47)' },
    { code: '+48', label: 'Poland (+48)' },
    { code: '+49', label: 'Germany (+49)' },
    { code: '+52', label: 'Mexico (+52)' },
    { code: '+55', label: 'Brazil (+55)' },
    { code: '+61', label: 'Australia (+61)' },
    { code: '+62', label: 'Indonesia (+62)' },
    { code: '+63', label: 'Philippines (+63)' },
    { code: '+65', label: 'Singapore (+65)' },
    { code: '+81', label: 'Japan (+81)' },
    { code: '+82', label: 'South Korea (+82)' },
    { code: '+86', label: 'China (+86)' },
    { code: '+90', label: 'Turkey (+90)' },
    { code: '+91', label: 'India (+91)' },
    { code: '+92', label: 'Pakistan (+92)' },
    { code: '+94', label: 'Sri Lanka (+94)' },
    { code: '+95', label: 'Myanmar (+95)' },
    { code: '+98', label: 'Iran (+98)' },
    { code: '+212', label: 'Morocco (+212)' },
    { code: '+351', label: 'Portugal (+351)' },
    { code: '+353', label: 'Ireland (+353)' },
    { code: '+358', label: 'Finland (+358)' },
    { code: '+380', label: 'Ukraine (+380)' },
    { code: '+420', label: 'Czechia (+420)' },
    { code: '+852', label: 'Hong Kong (+852)' },
    { code: '+886', label: 'Taiwan (+886)' },
    { code: '+971', label: 'United Arab Emirates (+971)' },
    { code: '+972', label: 'Israel (+972)' },
    { code: '+973', label: 'Bahrain (+973)' },
    { code: '+974', label: 'Qatar (+974)' },
    { code: '+975', label: 'Bhutan (+975)' },
    { code: '+976', label: 'Mongolia (+976)' },
    { code: '+977', label: 'Nepal (+977)' },
    { code: '+995', label: 'Georgia (+995)' }
  ];

  const normalizePhone = (raw) => (raw || '').toString().trim().replace(/[\s\-().]/g, '');

  const splitPhone = (raw) => {
    const cleaned = normalizePhone(raw);
    if (!cleaned) return { countryCode: '', nationalNumber: '' };

    if (cleaned.startsWith('+')) {
      const digits = cleaned.slice(1);
      const candidates = [...COUNTRY_DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
      for (const { code } of candidates) {
        const c = code.slice(1);
        if (digits.startsWith(c)) {
          return { countryCode: code, nationalNumber: digits.slice(c.length).replace(/\D/g, '') };
        }
      }
      // Fallback: take up to 4 digits as country code
      const match = /^\+(\d{1,4})(.*)$/.exec(cleaned);
      if (match) {
        return { countryCode: `+${match[1]}`, nationalNumber: (match[2] || '').replace(/\D/g, '') };
      }
    }

    return { countryCode: '', nationalNumber: cleaned.replace(/\D/g, '') };
  };

  const formatPhone = (countryCode, nationalNumber) => {
    const cc = (countryCode || '').toString().trim();
    const nn = (nationalNumber || '').toString().replace(/\D/g, '');
    if (!cc) return nn;
    const normalizedCc = cc.startsWith('+') ? cc : `+${cc.replace(/\D/g, '')}`;
    return `${normalizedCc}${nn}`;
  };
  const [contractFormData, setContractFormData] = useState({
    contract_name: '',
    vendor: '',
    contract_type: '',
    start_date: '',
    end_date: '',
    value: 0,
    status: 'Active',
    notes: ''
  });

  useEffect(() => {
    // Non-admins should not see admin dashboard/screens.
    if (!isAdmin) {
      setCurrentScreen('usage');
      setShowForm(false);
      setShowWelcome(false);
    }

    if (isAdmin) {
      loadAssets();
      loadLicenses();
      loadUsers();
      loadContracts();
    }

    // Check if user has visited before
    const hasVisited = localStorage.getItem('hasVisited');
    if (hasVisited) {
      setShowWelcome(false);
    }
  }, [isAdmin]);

  // Prevent non-admins from landing on admin-only screens (e.g. via stale state).
  useEffect(() => {
    const adminOnlyScreens = new Set(['home', 'assets', 'licenses', 'users', 'contracts', 'forbidden-apps', 'audit', 'topology']);
    if (!isAdmin && adminOnlyScreens.has(currentScreen)) {
      setCurrentScreen('usage');
      setShowForm(false);
    }
  }, [isAdmin, currentScreen]);

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('hasVisited', 'true');
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

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
      setError('Please enter an asset tag');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);
      if (editingId) {
        await dbService.updateAsset(editingId, formData);
        showSuccess('✅ Asset updated successfully!');
        setEditingId(null);
      } else {
        await dbService.createAsset(formData);
        showSuccess('✅ Asset added successfully!');
      }
      setFormData({
        asset_tag: '',
        asset_type: '',
        category: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        assigned_user_name: '',
        status: 'In Use',
        cost: 0
      });
      setShowForm(false);
      await loadAssets();
    } catch (err) {
      setError(`Failed to ${editingId ? 'update' : 'add'} asset: ${err.message}`);
      setTimeout(() => setError(null), 5000);
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
      category: asset.category || '',
      manufacturer: asset.manufacturer,
      model: asset.model,
      serial_number: asset.serial_number,
      assigned_user_name: asset.assigned_user_name,
      status: asset.status,
      cost: asset.cost || 0
    });
    setShowForm(true);
  };

  const handleDeleteAsset = async (id) => {
    if (!window.confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      return;
    }
    try {
      setLoading(true);
      await dbService.deleteAsset(id);
      showSuccess('✅ Asset deleted successfully!');
      await loadAssets();
    } catch (err) {
      setError(`Failed to delete asset: ${err.message}`);
      setTimeout(() => setError(null), 5000);
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

    // Validate dates
    if (contractFormData.start_date) {
      const startYear = new Date(contractFormData.start_date).getFullYear();
      if (startYear < 2000 || startYear > 2100) {
        setError('Start date year must be between 2000 and 2100');
        return;
      }
    }

    if (contractFormData.end_date) {
      const endYear = new Date(contractFormData.end_date).getFullYear();
      if (endYear < 2000 || endYear > 2100) {
        setError('End date year must be between 2000 and 2100');
        return;
      }
      
      // Check that end date is after start date
      if (contractFormData.start_date && contractFormData.end_date) {
        if (new Date(contractFormData.end_date) < new Date(contractFormData.start_date)) {
          setError('End date must be after start date');
          return;
        }
      }
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);
      
      // Ensure value is a valid number
      const contractData = {
        ...contractFormData,
        value: isNaN(contractFormData.value) || contractFormData.value === '' ? 0 : parseFloat(contractFormData.value)
      };
      
      if (editingId) {
        await dbService.updateContract(editingId, contractData);
        showSuccess('✅ Contract updated successfully!');
        setEditingId(null);
      } else {
        await dbService.createContract(contractData);
        showSuccess('✅ Contract added successfully!');
      }
      setContractFormData({
        contract_name: '',
        vendor: '',
        contract_type: '',
        start_date: '',
        end_date: '',
        value: 0,
        status: 'Active',
        notes: ''
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
    // Format dates to yyyy-MM-dd for date inputs
    const formattedContract = {
      ...contract,
      start_date: contract.start_date ? contract.start_date.split('T')[0] : '',
      end_date: contract.end_date ? contract.end_date.split('T')[0] : ''
    };
    setContractFormData(formattedContract);
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

  const filteredLicenses = licenses.filter(lic =>
    searchTerm
      ? lic.license_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lic.software_name?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const filteredUsers = users.filter(u =>
    searchTerm
      ? u.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const filteredContracts = contracts.filter(c =>
    searchTerm
      ? c.contract_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.vendor?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const exportCurrentScreenCsv = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (currentScreen === 'assets') {
      downloadCsv(`assets-${stamp}.csv`, filteredAssets, [
        { key: 'id', header: 'ID' },
        { key: 'asset_tag', header: 'Asset Tag' },
        { key: 'asset_type', header: 'Type' },
        { key: 'manufacturer', header: 'Manufacturer' },
        { key: 'model', header: 'Model' },
        { key: 'serial_number', header: 'Serial Number' },
        { key: 'assigned_user_name', header: 'Assigned User' },
        { key: 'status', header: 'Status' },
        { key: 'cost', header: 'Cost' },
        { key: 'created_at', header: 'Created At' },
        { key: 'updated_at', header: 'Updated At' },
      ]);
      return;
    }

    if (currentScreen === 'licenses') {
      downloadCsv(`licenses-${stamp}.csv`, filteredLicenses, [
        { key: 'id', header: 'ID' },
        { key: 'license_name', header: 'License Name' },
        { key: 'software_name', header: 'Software' },
        { key: 'vendor', header: 'Vendor' },
        { key: 'license_type', header: 'License Type' },
        { key: 'license_key', header: 'License Key' },
        { key: 'quantity', header: 'Quantity' },
        { key: 'expiration_date', header: 'Expiration Date' },
        { key: 'status', header: 'Status' },
        { key: 'cost', header: 'Cost' },
        { key: 'created_at', header: 'Created At' },
        { key: 'updated_at', header: 'Updated At' },
      ]);
      return;
    }

    if (currentScreen === 'users') {
      downloadCsv(`users-${stamp}.csv`, filteredUsers, [
        { key: 'id', header: 'ID' },
        { key: 'user_name', header: 'User Name' },
        { key: 'email', header: 'Email' },
        { key: 'department', header: 'Department' },
        { key: 'phone', header: 'Phone' },
        { key: 'role', header: 'Role' },
        { key: 'status', header: 'Status' },
        { key: 'created_at', header: 'Created At' },
        { key: 'updated_at', header: 'Updated At' },
      ]);
      return;
    }

    if (currentScreen === 'contracts') {
      downloadCsv(`contracts-${stamp}.csv`, filteredContracts, [
        { key: 'id', header: 'ID' },
        { key: 'contract_name', header: 'Contract Name' },
        { key: 'vendor', header: 'Vendor' },
        { key: 'contract_type', header: 'Contract Type' },
        { key: 'start_date', header: 'Start Date' },
        { key: 'end_date', header: 'End Date' },
        { key: 'value', header: 'Value' },
        { key: 'currency', header: 'Currency' },
        { key: 'status', header: 'Status' },
        { key: 'created_at', header: 'Created At' },
        { key: 'updated_at', header: 'Updated At' },
      ]);
    }
  };

  // Screen rendering functions
  const renderHomeScreen = () => (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-sm md:text-base text-slate-400">Quick access to all your IT assets</p>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <button
          onClick={() => { setCurrentScreen('assets'); setShowForm(false); }}
          className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl p-4 md:p-6 text-left transition-all transform hover:scale-105 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <HardDrive className="w-8 h-8 md:w-12 md:h-12 text-white opacity-80" />
            <span className="text-2xl md:text-4xl font-bold text-white">{assets.length}</span>
          </div>
          <h3 className="text-base md:text-xl font-semibold text-white mb-1">Assets</h3>
          <p className="text-blue-100 text-xs md:text-sm hidden sm:block">Manage hardware & equipment</p>
        </button>

        <button
          onClick={() => { setCurrentScreen('licenses'); setShowForm(false); }}
          className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-xl p-4 md:p-6 text-left transition-all transform hover:scale-105 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <FileText className="w-8 h-8 md:w-12 md:h-12 text-white opacity-80" />
            <span className="text-2xl md:text-4xl font-bold text-white">{licenses.length}</span>
          </div>
          <h3 className="text-base md:text-xl font-semibold text-white mb-1">Licenses</h3>
          <p className="text-purple-100 text-xs md:text-sm hidden sm:block">Track software licenses</p>
        </button>

        <button
          onClick={() => { setCurrentScreen('users'); setShowForm(false); }}
          className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl p-4 md:p-6 text-left transition-all transform hover:scale-105 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <Users className="w-8 h-8 md:w-12 md:h-12 text-white opacity-80" />
            <span className="text-2xl md:text-4xl font-bold text-white">{users.length}</span>
          </div>
          <h3 className="text-base md:text-xl font-semibold text-white mb-1">Users</h3>
          <p className="text-green-100 text-xs md:text-sm hidden sm:block">Manage team members</p>
        </button>

        <button
          onClick={() => { setCurrentScreen('contracts'); setShowForm(false); }}
          className="bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 rounded-xl p-4 md:p-6 text-left transition-all transform hover:scale-105 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <FileCheck className="w-8 h-8 md:w-12 md:h-12 text-white opacity-80" />
            <span className="text-2xl md:text-4xl font-bold text-white">{contracts.length}</span>
          </div>
          <h3 className="text-base md:text-xl font-semibold text-white mb-1">Contracts</h3>
          <p className="text-orange-100 text-xs md:text-sm hidden sm:block">View agreements</p>
        </button>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-6">
          <p className="text-slate-400 text-xs md:text-sm mb-2">Total Assets Value</p>
          <p className="text-2xl md:text-3xl font-bold text-blue-400">${formatCurrency(assets.reduce((sum, a) => sum + (parseFloat(a.cost) || 0), 0))}</p>
        </div>
        
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-6">
          <p className="text-slate-400 text-xs md:text-sm mb-2">Active Licenses</p>
          <p className="text-2xl md:text-3xl font-bold text-purple-400">{licenses.filter(l => l.status === 'Active').length}</p>
        </div>
        
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-6">
          <p className="text-slate-400 text-xs md:text-sm mb-2">Active Contracts</p>
          <p className="text-2xl md:text-3xl font-bold text-orange-400">{contracts.filter(c => c.status === 'Active').length}</p>
        </div>
      </div>
    </>
  );

  const renderSearchResults = () => {
    const query = universalSearch.toLowerCase().trim();
    
    if (!query) {
      return (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Universal Search</h2>
          <p className="text-slate-400">Search across all assets, licenses, users, and contracts</p>
        </div>
      );
    }

    const searchAssets = assets.filter(a => 
      a.asset_tag?.toLowerCase().includes(query) ||
      a.manufacturer?.toLowerCase().includes(query) ||
      a.model?.toLowerCase().includes(query) ||
      a.asset_type?.toLowerCase().includes(query) ||
      a.assigned_user_name?.toLowerCase().includes(query)
    );

    const searchLicenses = licenses.filter(l =>
      l.license_name?.toLowerCase().includes(query) ||
      l.software_name?.toLowerCase().includes(query) ||
      l.vendor?.toLowerCase().includes(query) ||
      l.license_type?.toLowerCase().includes(query)
    );

    const searchUsers = users.filter(u =>
      u.user_name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.department?.toLowerCase().includes(query) ||
      u.role?.toLowerCase().includes(query)
    );

    const searchContracts = contracts.filter(c =>
      c.contract_name?.toLowerCase().includes(query) ||
      c.vendor?.toLowerCase().includes(query) ||
      c.contract_type?.toLowerCase().includes(query)
    );

    const totalResults = searchAssets.length + searchLicenses.length + searchUsers.length + searchContracts.length;

    const exportSearchResultsCsv = () => {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rows = [
        ...searchAssets.map((a) => ({
          entity_type: 'asset',
          id: a.id,
          name: a.asset_tag,
          asset_type: a.asset_type,
          manufacturer: a.manufacturer,
          model: a.model,
          status: a.status,
        })),
        ...searchLicenses.map((l) => ({
          entity_type: 'license',
          id: l.id,
          name: l.license_name,
          software_name: l.software_name,
          vendor: l.vendor,
          status: l.status,
          expiration_date: l.expiration_date,
        })),
        ...searchUsers.map((u) => ({
          entity_type: 'user',
          id: u.id,
          name: u.user_name,
          email: u.email,
          department: u.department,
          role: u.role,
          status: u.status,
        })),
        ...searchContracts.map((c) => ({
          entity_type: 'contract',
          id: c.id,
          name: c.contract_name,
          vendor: c.vendor,
          contract_type: c.contract_type,
          status: c.status,
          start_date: c.start_date,
          end_date: c.end_date,
        })),
      ];

      downloadCsv(`search-results-${stamp}.csv`, rows, [
        { key: 'entity_type', header: 'Entity Type' },
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name' },
        { key: 'status', header: 'Status' },
        { key: 'asset_type', header: 'Asset Type' },
        { key: 'manufacturer', header: 'Manufacturer' },
        { key: 'model', header: 'Model' },
        { key: 'software_name', header: 'Software' },
        { key: 'vendor', header: 'Vendor' },
        { key: 'expiration_date', header: 'Expiration Date' },
        { key: 'email', header: 'Email' },
        { key: 'department', header: 'Department' },
        { key: 'role', header: 'Role' },
        { key: 'contract_type', header: 'Contract Type' },
        { key: 'start_date', header: 'Start Date' },
        { key: 'end_date', header: 'End Date' },
      ]);
    };

    return (
      <>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Search Results</h1>
            <p className="text-sm md:text-base text-slate-400">Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{universalSearch}"</p>
          </div>
          {totalResults > 0 && (
            <button
              onClick={exportSearchResultsCsv}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition whitespace-nowrap text-sm md:text-base border border-slate-600"
            >
              <Download className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          )}
        </div>

        {totalResults === 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
            <p className="text-slate-400">No results found. Try a different search term.</p>
          </div>
        )}

        {searchAssets.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-bold text-white">Assets ({searchAssets.length})</h2>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Asset Tag</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Manufacturer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Model</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Cost</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {searchAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-slate-700/50 transition">
                        <td className="px-6 py-4 text-white font-medium">{asset.asset_tag}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 text-xs rounded-full bg-blue-900 text-blue-200">{asset.asset_type}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{asset.manufacturer}</td>
                        <td className="px-6 py-4 text-slate-300">{asset.model}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            asset.status === 'In Use' ? 'bg-green-900 text-green-200' : 'bg-slate-600 text-slate-300'
                          }`}>
                            {asset.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300">${parseFloat(asset.cost || 0).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => { setCurrentScreen('assets'); setSearchTerm(asset.asset_tag); setUniversalSearch(''); }}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            View in Assets
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {searchLicenses.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-purple-500" />
              <h2 className="text-xl font-bold text-white">Licenses ({searchLicenses.length})</h2>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">License Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Software</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Vendor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {searchLicenses.map((license) => (
                      <tr key={license.id} className="hover:bg-slate-700/50 transition">
                        <td className="px-6 py-4 text-white font-medium">{license.license_name}</td>
                        <td className="px-6 py-4 text-slate-300">{license.software_name}</td>
                        <td className="px-6 py-4 text-slate-300">{license.vendor}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            license.status === 'Active' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                          }`}>
                            {license.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => { setCurrentScreen('licenses'); setUniversalSearch(''); }}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            View in Licenses
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {searchUsers.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold text-white">Users ({searchUsers.length})</h2>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {searchUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-700/50 transition">
                        <td className="px-6 py-4 text-white font-medium">{user.user_name}</td>
                        <td className="px-6 py-4 text-slate-300">{user.email}</td>
                        <td className="px-6 py-4 text-slate-300">{user.department}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            user.status === 'Active' ? 'bg-green-900 text-green-200' : 'bg-slate-600 text-slate-300'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => { setCurrentScreen('users'); setUniversalSearch(''); }}
                            className="text-green-400 hover:text-green-300"
                          >
                            View in Users
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {searchContracts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileCheck className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-bold text-white">Contracts ({searchContracts.length})</h2>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Contract Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Vendor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {searchContracts.map((contract) => (
                      <tr key={contract.id} className="hover:bg-slate-700/50 transition">
                        <td className="px-6 py-4 text-white font-medium">{contract.contract_name}</td>
                        <td className="px-6 py-4 text-slate-300">{contract.vendor}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 text-xs rounded-full bg-orange-900 text-orange-200">{contract.contract_type}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            contract.status === 'Active' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                          }`}>
                            {contract.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => { setCurrentScreen('contracts'); setUniversalSearch(''); }}
                            className="text-orange-400 hover:text-orange-300"
                          >
                            View in Contracts
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderAssetsScreen = () => {
    const locationCount = assets.reduce((set, a) => {
      const key = a?.location_id ?? (a?.location || '').trim();
      if (key) set.add(String(key));
      return set;
    }, new Set()).size;
    const employeeCount = assets.reduce((set, a) => {
      const key = (a?.assigned_user_name || '').trim();
      if (key) set.add(key.toLowerCase());
      return set;
    }, new Set()).size;
    const showLocationNudge = locationCount < 2;
    const showEmployeeNudge = employeeCount < 3;

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

      {loading && (
        <div className="mb-6 p-4 bg-blue-900 border border-blue-700 rounded-lg">
          <p className="text-blue-200">Loading...</p>
        </div>
      )}

      {showForm && (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 mb-8 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">{editingId ? 'Edit Asset' : 'Add New Asset'}</h2>
            {!editingId && (
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
              >
                <Camera className="w-4 h-4" />
                <span>Scan QR Code</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              id="asset_tag"
              name="asset_tag"
              type="text"
              placeholder="Asset Tag"
              value={formData.asset_tag}
              onChange={(e) => setFormData({...formData, asset_tag: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <select
              id="asset_type"
              name="asset_type"
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
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            >
              <option value="">Select Category</option>
              {ASSET_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
            <input
              id="manufacturer"
              name="manufacturer"
              type="text"
              placeholder="Manufacturer"
              value={formData.manufacturer}
              onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="model"
              name="model"
              type="text"
              placeholder="Model"
              value={formData.model}
              onChange={(e) => setFormData({...formData, model: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="serial_number"
              name="serial_number"
              type="text"
              placeholder="Serial Number"
              value={formData.serial_number}
              onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="assigned_user_name"
              name="assigned_user_name"
              type="email"
              placeholder="Assigned User"
              autoComplete="email"
              value={formData.assigned_user_name}
              onChange={(e) => setFormData({...formData, assigned_user_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="asset_cost"
              name="asset_cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="Cost ($)"
              value={formData.cost}
              onChange={(e) => setFormData({...formData, cost: parseFloat(e.target.value) || 0})}
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
                  status: 'In Use',
                  cost: 0
                });
              }}
              className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editingId && (
        <DigitalReceipts assetId={editingId} />
      )}

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            id="asset_search"
            name="asset_search"
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {(showLocationNudge || showEmployeeNudge) && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {showLocationNudge && (
            <div className="bg-slate-700 border border-blue-700/60 rounded-lg p-4 flex items-start gap-3 shadow-lg">
              <div className="mt-0.5">
                <Boxes className="w-5 h-5 text-blue-300" />
              </div>
              <div className="space-y-1">
                <p className="text-white font-semibold text-sm">Add a second location</p>
                <p className="text-slate-300 text-sm">You have one default location. Create another for remote or branch offices to keep assets organized.</p>
              </div>
            </div>
          )}
          {showEmployeeNudge && (
            <div className="bg-slate-700 border border-emerald-700/60 rounded-lg p-4 flex items-start gap-3 shadow-lg">
              <div className="mt-0.5">
                <Users className="w-5 h-5 text-emerald-300" />
              </div>
              <div className="space-y-1">
                <p className="text-white font-semibold text-sm">Invite your team</p>
                <p className="text-slate-300 text-sm">You have a few assignees. Invite team members so they can manage their own gear.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-800 border-b border-slate-600">
              <tr>
                <th className="px-3 lg:px-6 py-3 text-left text-slate-300 font-semibold">Asset Tag</th>
                <th className="px-3 lg:px-6 py-3 text-left text-slate-300 font-semibold">Category</th>
                <th className="px-3 lg:px-6 py-3 text-left text-slate-300 font-semibold">Type</th>
                <th className="px-3 lg:px-6 py-3 text-left text-slate-300 font-semibold">Manufacturer</th>
                <th className="px-3 lg:px-6 py-3 text-left text-slate-300 font-semibold">Model</th>
                <th className="px-3 lg:px-6 py-3 text-left text-slate-300 font-semibold">Assigned User</th>
                <th className="px-3 lg:px-6 py-3 text-left text-slate-300 font-semibold">Status</th>
                <th className="px-3 lg:px-6 py-3 text-left text-slate-300 font-semibold">Cost</th>
                <th className="px-3 lg:px-6 py-3 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <HardDrive className="w-16 h-16 text-slate-600" />
                      <div>
                        <p className="text-slate-300 text-lg font-medium">No assets yet</p>
                        <p className="text-slate-500 text-sm mt-1">Click "Add Asset" to start tracking your IT equipment</p>
                      </div>
                      <button
                        onClick={() => setShowForm(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition whitespace-nowrap text-sm md:text-base mt-2"
                      >
                        <Plus className="w-4 h-4 md:w-5 md:h-5" />
                        Add Your First Asset
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const isNew = isRecentlyCreated(asset?.created_at);
                  const category = asset.category ? getCategoryById(asset.category) : null;
                  return (
                  <tr key={asset.id} className={`border-b border-slate-600 hover:bg-slate-600 transition ${isNew ? 'ring-1 ring-blue-500/40' : ''}`}>
                    <td className="px-3 lg:px-6 py-4 text-white font-medium">
                      <div className="flex items-center gap-2">
                        <span>{asset.asset_tag}</span>
                        {isNew && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-200">Just added</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 lg:px-6 py-4">
                      {category ? (
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${getCategoryColorClasses(asset.category, 'bg')}`}>
                            <CategoryIcon iconName={category.icon} className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-slate-300 text-xs">{category.label}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Not set</span>
                      )}
                    </td>
                    <td className="px-3 lg:px-6 py-4 text-slate-300">
                      <span className="bg-blue-900 text-blue-200 px-2 py-1 rounded text-xs">
                        {asset.asset_type}
                      </span>
                    </td>
                    <td className="px-3 lg:px-6 py-4 text-slate-300">{asset.manufacturer}</td>
                    <td className="px-3 lg:px-6 py-4 text-slate-300">{asset.model}</td>
                    <td className="px-3 lg:px-6 py-4 text-slate-300">{asset.assigned_user_name}</td>
                    <td className="px-3 lg:px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        asset.status === 'In Use' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-3 lg:px-6 py-4 text-slate-300">${parseFloat(asset.cost || 0).toFixed(2)}</td>
                    <td className="px-3 lg:px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditAsset(asset)}
                          className="text-blue-400 hover:text-blue-300 transition"
                          title="Edit Asset"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAssetForQR(asset);
                            setShowQRGenerator(true);
                          }}
                          className="text-purple-400 hover:text-purple-300 transition"
                          title="Generate QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="text-red-400 hover:text-red-300 transition"
                          title="Delete Asset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
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
  };

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
              id="license_name"
              name="license_name"
              type="text"
              placeholder="License Name"
              value={licenseFormData.license_name}
              onChange={(e) => setLicenseFormData({...licenseFormData, license_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="license_type"
              name="license_type"
              type="text"
              placeholder="License Type"
              value={licenseFormData.license_type}
              onChange={(e) => setLicenseFormData({...licenseFormData, license_type: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="license_key"
              name="license_key"
              type="text"
              placeholder="License Key"
              value={licenseFormData.license_key}
              onChange={(e) => setLicenseFormData({...licenseFormData, license_key: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="software_name"
              name="software_name"
              type="text"
              placeholder="Software Name"
              value={licenseFormData.software_name}
              onChange={(e) => setLicenseFormData({...licenseFormData, software_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="vendor"
              name="vendor"
              type="text"
              placeholder="Vendor"
              value={licenseFormData.vendor}
              onChange={(e) => setLicenseFormData({...licenseFormData, vendor: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="expiration_date"
              name="expiration_date"
              type="date"
              placeholder="Expiration Date"
              value={licenseFormData.expiration_date}
              onChange={(e) => setLicenseFormData({...licenseFormData, expiration_date: e.target.value})}
              min="2000-01-01"
              max="2100-12-31"
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="quantity"
              name="quantity"
              type="number"
              placeholder="Quantity"
              value={licenseFormData.quantity}
              onChange={(e) => setLicenseFormData({...licenseFormData, quantity: parseInt(e.target.value)})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <select
              id="license_status"
              name="license_status"
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
                filteredLicenses.map((license) => (
                  <tr key={license.id} className="border-b border-slate-600 hover:bg-slate-600 transition">
                    <td className="px-6 py-4 text-white font-medium">{license.license_name}</td>
                    <td className="px-6 py-4 text-slate-300">{license.software_name}</td>
                    <td className="px-6 py-4 text-slate-300">{license.vendor}</td>
                    <td className="px-6 py-4 text-slate-300">{formatDate(license.expiration_date)}</td>
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
              id="user_name"
              name="user_name"
              type="text"
              placeholder="User Name"
              value={userFormData.user_name}
              onChange={(e) => setUserFormData({...userFormData, user_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="user_email"
              name="user_email"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={userFormData.email}
              onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="department"
              name="department"
              type="text"
              placeholder="Department"
              value={userFormData.department}
              onChange={(e) => setUserFormData({...userFormData, department: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Phone"
              value={userFormData.phone}
              onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
              className="hidden"
            />
            {(() => {
              const { countryCode, nationalNumber } = splitPhone(userFormData.phone);
              return (
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="tel"
                    list="countryDialCodes"
                    placeholder="+972"
                    value={countryCode}
                    onChange={(e) => {
                      const nextCode = e.target.value;
                      setUserFormData({
                        ...userFormData,
                        phone: formatPhone(nextCode, nationalNumber)
                      });
                    }}
                    className="w-40 px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
                    aria-label="Country code"
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="Phone number"
                    value={nationalNumber}
                    onChange={(e) => {
                      const nextNational = e.target.value;
                      setUserFormData({
                        ...userFormData,
                        phone: formatPhone(countryCode, nextNational)
                      });
                    }}
                    className="flex-1 px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
                    aria-label="Phone number"
                  />
                  <datalist id="countryDialCodes">
                    {COUNTRY_DIAL_CODES.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </datalist>
                </div>
              );
            })()}
            <input
              id="user_role"
              name="user_role"
              type="text"
              placeholder="Role"
              value={userFormData.role}
              onChange={(e) => setUserFormData({...userFormData, role: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <select
              id="user_status"
              name="user_status"
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
                filteredUsers.map((user) => (
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
              id="contract_name"
              name="contract_name"
              type="text"
              placeholder="Contract Name"
              value={contractFormData.contract_name}
              onChange={(e) => setContractFormData({...contractFormData, contract_name: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="contract_vendor"
              name="contract_vendor"
              type="text"
              placeholder="Vendor"
              value={contractFormData.vendor}
              onChange={(e) => setContractFormData({...contractFormData, vendor: e.target.value})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <select
              id="contract_type"
              name="contract_type"
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
              id="start_date"
              name="start_date"
              type="date"
              placeholder="Start Date"
              value={contractFormData.start_date}
              onChange={(e) => setContractFormData({...contractFormData, start_date: e.target.value})}
              min="2000-01-01"
              max="2100-12-31"
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="end_date"
              name="end_date"
              type="date"
              placeholder="End Date"
              value={contractFormData.end_date}
              onChange={(e) => setContractFormData({...contractFormData, end_date: e.target.value})}
              min="2000-01-01"
              max="2100-12-31"
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <input
              id="contract_value"
              name="contract_value"
              type="number"
              placeholder="Value"
              value={contractFormData.value}
              onChange={(e) => setContractFormData({...contractFormData, value: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
              className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            <select
              id="contract_status"
              name="contract_status"
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
              id="contract_notes"
              name="contract_notes"
              placeholder="Notes"
              value={contractFormData.notes}
              onChange={(e) => setContractFormData({...contractFormData, notes: e.target.value})}
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
                filteredContracts.map((contract) => (
                  <tr key={contract.id} className="border-b border-slate-600 hover:bg-slate-600 transition">
                    <td className="px-6 py-4 text-white font-medium">{contract.contract_name}</td>
                    <td className="px-6 py-4 text-slate-300">{contract.vendor}</td>
                    <td className="px-6 py-4 text-slate-300">
                      <span className="bg-purple-900 text-purple-200 px-2 py-1 rounded text-xs">
                        {contract.contract_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{formatDate(contract.start_date)}</td>
                    <td className="px-6 py-4 text-slate-300">{formatDate(contract.end_date)}</td>
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
    if (universalSearch.trim()) {
      return renderSearchResults();
    }
    
    switch(currentScreen) {
      case 'home':
        return renderHomeScreen();
      case 'assets':
        return renderAssetsScreen();
      case 'consumables':
        return <Consumables />;
      case 'licenses':
        return renderLicensesScreen();
      case 'users':
        return renderUsersScreen();
      case 'contracts':
        return renderContractsScreen();
      case 'receipts':
        return <ReceiptsView />;
      case 'usage':
        return <UsageMonitor />;
      case 'forbidden-apps':
        return <ForbiddenApps />;
      case 'dashboards':
        return <GrafanaDashboards />;
      case 'alerts':
        return <AlertHistory />;
      case 'topology':
        return <NetworkTopology />;
      case 'stock':
        return <StockOverview />;
      case 'billing':
        return <Billing />;
      case 'audit':
        return <AuditTrail />;
      default:
        return renderHomeScreen();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      {/* Welcome Guide - First Time Users */}
      {showWelcome && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 md:p-8 max-w-2xl shadow-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <HelpCircle className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
              <h2 className="text-xl md:text-2xl font-bold text-white">Welcome to IT Asset Tracker! 👋</h2>
            </div>
            <div className="space-y-4 text-slate-300">
              <p className="text-base md:text-lg">Here's how to get started:</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                  <div>
                    <p className="font-semibold text-white">Add Your First Asset</p>
                    <p className="text-sm">Click the "Add Asset" button to track laptops, desktops, and equipment</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                  <div>
                    <p className="font-semibold text-white">Manage Software Licenses</p>
                    <p className="text-sm">Use the Licenses tab to track software licenses and subscriptions</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                  <div>
                    <p className="font-semibold text-white">Track Users & Contracts</p>
                    <p className="text-sm">Keep records of team members and vendor contracts in one place</p>
                  </div>
                </div>
              </div>
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4 mt-6">
                <p className="text-sm"><strong>💡 Tip:</strong> Use the search bar to quickly find any item across all categories!</p>
              </div>
            </div>
            <button
              onClick={dismissWelcome}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
            >
              Got it, let's start!
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
            <X className="w-5 h-5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} lg:w-64 bg-slate-800 border-r border-slate-700 transition-all duration-300 overflow-hidden flex flex-col absolute lg:relative h-full z-20 lg:z-auto`}>
        <div className="p-6 border-b border-slate-700">
          <button 
            onClick={() => { setCurrentScreen(isAdmin ? 'home' : 'usage'); setShowForm(false); }}
            className="flex items-center justify-center w-full hover:opacity-80 transition cursor-pointer"
          >
            <img src="/logo.svg" alt="Asset Tracker" className="h-12 w-auto" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => { setCurrentScreen('dashboards'); setShowForm(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              currentScreen === 'dashboards'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Dashboards</span>
          </button>

          {isAdmin && (
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
          )}

          {isAdmin && (
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
          )}

          {isAdmin && (
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
          )}

          {isAdmin && (
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
          )}

          {isAdmin && (
            <button
              onClick={() => { setCurrentScreen('receipts'); setShowForm(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                currentScreen === 'receipts' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span>Receipts</span>
            </button>
          )}

          <button
            onClick={() => { setCurrentScreen('usage'); setShowForm(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              currentScreen === 'usage' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Activity className="w-5 h-5" />
            <span>Usage Monitor</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => { setCurrentScreen('forbidden-apps'); setShowForm(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                currentScreen === 'forbidden-apps' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span>Forbidden Apps</span>
            </button>
          )}

          <button
            onClick={() => { setCurrentScreen('alerts'); setShowForm(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              currentScreen === 'alerts' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
            <span>Security Alerts</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => { setCurrentScreen('consumables'); setShowForm(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                currentScreen === 'consumables' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Boxes className="w-5 h-5" />
              <span>Consumables</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => { setCurrentScreen('topology'); setShowForm(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                currentScreen === 'topology' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Network className="w-5 h-5" />
              <span>Network Topology</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => { setCurrentScreen('stock'); setShowForm(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                currentScreen === 'stock' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Boxes className="w-5 h-5" />
              <span>Stock Overview</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => { setCurrentScreen('audit'); setShowForm(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                currentScreen === 'audit' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              <FileCheck className="w-5 h-5" />
              <span>Audit Trail</span>
            </button>
          )}

          <button
            onClick={() => { setCurrentScreen('billing'); setShowForm(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              currentScreen === 'billing'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span>Billing</span>
          </button>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-700">
          <div className="text-slate-400 text-sm mb-3">
            <div className="font-medium text-white">{user?.username?.replace(/_\d{4}$/, '') || 'User'}</div>
            <div className="text-xs">{user?.email || ''}</div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Mobile overlay when sidebar is open */}
        {sidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 shadow-lg relative z-5 flex-shrink-0">
          <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2 md:gap-4 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-slate-700 rounded-lg transition text-slate-300"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Universal Search */}
            <div className="flex-1 max-w-2xl min-w-0">
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={universalSearch}
                  onChange={(e) => setUniversalSearch(e.target.value)}
                  className="w-full pl-9 md:pl-10 pr-8 md:pr-4 py-2 text-sm md:text-base bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {universalSearch && (
                  <button
                    onClick={() => setUniversalSearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Trial Counter */}
              {user?.trialEndsAt && !user?.subscriptionActive && (() => {
                const now = new Date();
                const trialEnd = new Date(user.trialEndsAt);
                const daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
                const isExpiringSoon = daysRemaining <= 7;
                
                return (
                  <button
                    onClick={() => setCurrentScreen('billing')}
                    className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border transition cursor-pointer hover:opacity-80 ${
                    isExpiringSoon 
                      ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  }`}>
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium whitespace-nowrap">
                      {daysRemaining === 0 ? 'Trial Expired' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`}
                    </span>
                  </button>
                );
              })()}

              {['assets', 'licenses', 'users', 'contracts'].includes(currentScreen) && !universalSearch && (
                <>
                  <button
                    onClick={exportCurrentScreenCsv}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition whitespace-nowrap text-sm md:text-base border border-slate-600 flex-shrink-0"
                    title="Export CSV"
                  >
                    <Download className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                    <span className="hidden md:inline">Export CSV</span>
                  </button>

                  <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 transition whitespace-nowrap text-sm md:text-base flex-shrink-0"
                    title={currentScreen === 'assets' ? 'Add Asset' : currentScreen === 'licenses' ? 'Add License' : currentScreen === 'users' ? 'Add User' : 'Add Contract'}
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                    <span className="hidden md:inline">
                      {currentScreen === 'assets'
                        ? 'Add Asset'
                        : currentScreen === 'licenses'
                          ? 'Add License'
                          : currentScreen === 'users'
                            ? 'Add User'
                            : 'Add Contract'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Screen Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {renderScreen()}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-700 py-4 px-4 md:px-6 lg:px-8 bg-slate-800/50">
          <div className="max-w-7xl mx-auto text-center text-slate-500 text-xs">
            <p>© 2026 IT Asset Manager. All rights reserved.</p>
            <div className="mt-2 flex items-center justify-center gap-4">
              <a
                href={`${import.meta.env.VITE_API_URL || 'https://it-asset-project-production.up.railway.app'}/api/legal/privacy-policy`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-blue-400 transition"
              >
                Privacy Policy
              </a>
              <span>•</span>
              <a
                href={`${import.meta.env.VITE_API_URL || 'https://it-asset-project-production.up.railway.app'}/api/legal/terms-of-service`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-blue-400 transition"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* QR Code Scanner Modal */}
      {showScanner && (
        <AssetScanner onClose={() => setShowScanner(false)} />
      )}

      {/* QR Code Generator Modal */}
      {showQRGenerator && selectedAssetForQR && (
        <QRCodeGenerator 
          asset={selectedAssetForQR} 
          onClose={() => {
            setShowQRGenerator(false);
            setSelectedAssetForQR(null);
          }} 
        />
      )}
    </div>
  );
}
