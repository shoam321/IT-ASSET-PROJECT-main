import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, Plus, Trash2, Edit2, ExternalLink, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

export default function GrafanaDashboards() {
  const { token } = useAuth();
  const [dashboards, setDashboards] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ name: '', embedUrl: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);

  const selected = useMemo(() => dashboards.find((d) => d.id === selectedId) || dashboards[0], [dashboards, selectedId]);

  const loadDashboards = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/grafana/dashboards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Failed to load dashboards');
      setDashboards(data?.dashboards || []);
      if ((data?.dashboards || []).length && !selectedId) {
        setSelectedId(data.dashboards[0].id);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetForm = () => {
    setForm({ name: '', embedUrl: '', description: '' });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `${API_URL}/grafana/dashboards/${editingId}`
        : `${API_URL}/grafana/dashboards`;
      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Failed to save dashboard');
      setSuccess(editingId ? 'Dashboard updated' : 'Dashboard added');
      resetForm();
      await loadDashboards();
    } catch (err) {
      setError(err?.message || 'Failed to save dashboard');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (dash) => {
    setEditingId(dash.id);
    setForm({ name: dash.name || '', embedUrl: dash.embed_url || '', description: dash.description || '' });
  };

  const handleDelete = async (id) => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/grafana/dashboards/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Failed to delete dashboard');
      if (selectedId === id) setSelectedId(null);
      await loadDashboards();
    } catch (err) {
      setError(err?.message || 'Failed to delete dashboard');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboards</h1>
          <p className="text-slate-400 text-sm">Embed your organization’s Grafana dashboards.</p>
        </div>
        <div className="flex gap-2 items-center">
          {loading && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
          {success && <span className="text-emerald-400 text-sm">{success}</span>}
          {error && (
            <span className="text-red-400 text-sm inline-flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Plus className="w-4 h-4" />
              <span>{editingId ? 'Edit Dashboard' : 'Add Dashboard'}</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm text-slate-300">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Ops Overview"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Embed URL</label>
                <input
                  required
                  value={form.embedUrl}
                  onChange={(e) => setForm({ ...form, embedUrl: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="https://your-grafana.example.com/d/uid"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Description (optional)</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="SRE latency & error budget"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingId ? 'Update' : 'Add'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-2 rounded-lg border border-slate-600 text-slate-200"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="text-slate-200 font-semibold">Saved Dashboards</div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {dashboards.length === 0 && (
                <p className="text-slate-400 text-sm">No dashboards yet. Add one to get started.</p>
              )}
              {dashboards.map((dash) => (
                <div
                  key={dash.id}
                  className={`flex items-start justify-between gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    selected?.id === dash.id ? 'border-blue-500 bg-slate-700/70' : 'border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedId(dash.id)}
                >
                  <div className="flex-1">
                    <p className="text-white font-semibold">{dash.name}</p>
                    {dash.description && <p className="text-slate-400 text-xs mt-1">{dash.description}</p>}
                  </div>
                  <div className="flex gap-2 text-slate-300">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(dash); }} className="hover:text-blue-300">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(dash.id); }} className="hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 min-h-[480px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-slate-200 font-semibold">{selected?.name || 'Select a dashboard'}</p>
                {selected?.description && <p className="text-slate-400 text-sm">{selected.description}</p>}
              </div>
              {selected?.embed_url && (
                <a
                  href={selected.embed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 text-sm"
                >
                  Open <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            {selected?.embed_url ? (
              <div className="flex-1 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                <iframe
                  title={selected.name}
                  src={selected.embed_url}
                  className="w-full h-full min-h-[420px]"
                  allowFullScreen
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a dashboard to view</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
