import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit2, Trash2, TrendingDown, TrendingUp, AlertTriangle, X, History } from 'lucide-react';

const Consumables = () => {
  const [consumables, setConsumables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAdjustModal, setShowAdjustModal] = useState(null);
  const [showTransactions, setShowTransactions] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // all, in-stock, low, out

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    quantity: 0,
    min_quantity: 5,
    unit: 'pieces',
    unit_cost: 0,
    location: '',
    supplier: '',
    sku: '',
    notes: ''
  });

  const [adjustData, setAdjustData] = useState({
    quantity: 0,
    reason: ''
  });

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

  useEffect(() => {
    fetchConsumables();
  }, []);

  const fetchConsumables = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/consumables`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch consumables');
      const data = await response.json();
      setConsumables(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      const url = editingId 
        ? `${API_URL}/consumables/${editingId}`
        : `${API_URL}/consumables`;
      
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save consumable');
      
      await fetchConsumables();
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this consumable?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/consumables/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete consumable');
      await fetchConsumables();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdjustStock = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/consumables/${showAdjustModal}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(adjustData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to adjust stock');
      }
      
      await fetchConsumables();
      setShowAdjustModal(null);
      setAdjustData({ quantity: 0, reason: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchTransactions = async (id) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/consumables/${id}/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch transactions');
      const data = await response.json();
      setTransactions(data);
      setShowTransactions(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      quantity: 0,
      min_quantity: 5,
      unit: 'pieces',
      unit_cost: 0,
      location: '',
      supplier: '',
      sku: '',
      notes: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (consumable) => {
    setFormData(consumable);
    setEditingId(consumable.id);
    setShowForm(true);
  };

  const getStockStatus = (item) => {
    if (item.quantity === 0) return { status: 'out', color: 'red', label: 'OUT OF STOCK' };
    if (item.quantity <= item.min_quantity) return { status: 'low', color: 'yellow', label: 'LOW STOCK' };
    return { status: 'ok', color: 'green', label: 'IN STOCK' };
  };

  const filteredConsumables = consumables.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    const { status } = getStockStatus(item);
    if (statusFilter === 'in-stock') return matchesSearch && status === 'ok';
    if (statusFilter === 'low') return matchesSearch && status === 'low';
    if (statusFilter === 'out') return matchesSearch && status === 'out';
    
    return matchesSearch;
  });

  const stats = {
    total: consumables.length,
    lowStock: consumables.filter(i => i.quantity <= i.min_quantity && i.quantity > 0).length,
    outOfStock: consumables.filter(i => i.quantity === 0).length,
    totalValue: consumables.reduce((sum, i) => sum + (i.quantity * i.unit_cost), 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Consumables Inventory</h1>
          <p className="text-slate-400">Track stock levels of cables, toner, and other consumables</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showForm ? 'Cancel' : 'Add Item'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="text-sm mt-2 underline">Dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
          <p className="text-slate-400 text-sm">Total Items</p>
          <p className="text-3xl font-bold text-white mt-2">{stats.total}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
          <p className="text-slate-400 text-sm">Low Stock</p>
          <p className="text-3xl font-bold text-yellow-400 mt-2">{stats.lowStock}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
          <p className="text-slate-400 text-sm">Out of Stock</p>
          <p className="text-3xl font-bold text-red-400 mt-2">{stats.outOfStock}</p>
        </div>
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
          <p className="text-slate-400 text-sm">Total Value</p>
          <p className="text-3xl font-bold text-green-400 mt-2">${stats.totalValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            {editingId ? 'Edit' : 'Add'} Consumable
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
                placeholder="e.g., HDMI Cable 6ft"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              >
                <option value="">Select category</option>
                <option value="Cables">Cables</option>
                <option value="Batteries">Batteries</option>
                <option value="Toner/Ink">Toner/Ink</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Cleaning Supplies">Cleaning Supplies</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Current Quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Low Stock Alert Threshold
                <span className="ml-2 text-xs text-amber-400">📧 Email alert when below</span>
              </label>
              <input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
                placeholder="e.g., 5"
              />
              <p className="text-xs text-slate-400 mt-1">
                ⚠️ You'll receive an email when stock drops to or below this number
              </p>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Unit</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
                placeholder="pieces, meters, boxes"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Unit Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
                placeholder="Storage room, Office A"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Supplier</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
                rows="2"
              />
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
              >
                {editingId ? 'Update' : 'Create'} Item
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-700 border border-slate-600 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search consumables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            >
              <option value="all">All Status</option>
              <option value="in-stock">✅ In Stock</option>
              <option value="low">⚠️ Low Stock</option>
              <option value="out">🔴 Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Consumables List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-400">Loading consumables...</p>
        </div>
      ) : filteredConsumables.length === 0 ? (
        <div className="text-center py-12 bg-slate-700 border border-slate-600 rounded-lg">
          <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No consumables found</p>
          <p className="text-slate-500 text-sm mt-2">Add items to start tracking inventory</p>
        </div>
      ) : (
        <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-600">
              {filteredConsumables.map((item) => {
                const stockStatus = getStockStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-slate-600 transition">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-slate-400 text-sm">{item.description}</p>
                        )}
                        {item.sku && (
                          <p className="text-slate-500 text-xs mt-1">SKU: {item.sku}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded">
                        {item.category || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white font-semibold">
                          {item.quantity} {item.unit}
                        </p>
                        <p className="text-slate-400 text-xs flex items-center gap-1">
                          📧 Alert at: {item.min_quantity} {item.unit}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                        stockStatus.color === 'green' ? 'bg-green-900 text-green-200' :
                        stockStatus.color === 'yellow' ? 'bg-yellow-900 text-yellow-200' :
                        'bg-red-900 text-red-200'
                      }`}>
                        {stockStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white">${(item.quantity * item.unit_cost).toFixed(2)}</p>
                        <p className="text-slate-400 text-xs">${item.unit_cost}/unit</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{item.location || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowAdjustModal(item.id)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-slate-700 rounded transition"
                          title="Adjust Stock"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => fetchTransactions(item.id)}
                          className="p-2 text-purple-400 hover:text-purple-300 hover:bg-slate-700 rounded transition"
                          title="View History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEdit(item)}
                          className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-slate-700 rounded transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Adjust Stock</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Quantity (+ to add, - to remove)</label>
                <input
                  type="number"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="e.g., 10 or -5"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Reason</label>
                <input
                  type="text"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="e.g., Restocked or Used for project"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdjustStock}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setShowAdjustModal(null);
                    setAdjustData({ quantity: 0, reason: '' });
                  }}
                  className="flex-1 bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {showTransactions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full border border-slate-700 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Transaction History</h3>
              <button onClick={() => setShowTransactions(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {transactions.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="bg-slate-700 border border-slate-600 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {tx.transaction_type === 'add' ? (
                          <TrendingUp className="w-5 h-5 text-green-400 mt-0.5" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-400 mt-0.5" />
                        )}
                        <div>
                          <p className="text-white font-medium">
                            {tx.transaction_type === 'add' ? 'Added' : 'Removed'} {Math.abs(tx.quantity_change)} units
                          </p>
                          <p className="text-slate-400 text-sm">
                            {tx.quantity_before} → {tx.quantity_after} units
                          </p>
                          {tx.reason && (
                            <p className="text-slate-400 text-sm mt-1">Reason: {tx.reason}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 text-xs">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-slate-500 text-xs">{tx.performed_by_name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Consumables;
