import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from '@xyflow/react';
import { Save, Download, Plus, Server, Monitor, Wifi, Shield } from 'lucide-react';
import '@xyflow/react/dist/style.css';

const CustomDeviceNode = ({ data }) => {
  const getStatusColor = (status) => {
    if (status === 'online') return 'bg-green-500';
    if (status === 'idle') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-slate-700 border-2 border-slate-600 rounded-lg p-4 min-w-[200px] shadow-xl hover:border-blue-500 transition-all">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(data.status)} shadow-lg`}></div>
        <span className="text-lg">{data.icon}</span>
        <span className="text-white font-semibold text-sm">{data.label}</span>
      </div>
      
      {data.deviceInfo && (
        <div className="mt-3 pt-3 border-t border-slate-600 text-xs text-slate-300 space-y-1">
          <div className="flex justify-between">
            <span>OS:</span>
            <span className="font-medium">{data.deviceInfo.os || 'Unknown'}</span>
          </div>
          {data.deviceInfo.alerts > 0 && (
            <div className="flex justify-between text-red-400">
              <span>Alerts:</span>
              <span className="font-bold">{data.deviceInfo.alerts}</span>
            </div>
          )}
          {data.deviceInfo.apps && (
            <div className="flex justify-between">
              <span>Apps:</span>
              <span className="font-medium">{data.deviceInfo.apps}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  custom: CustomDeviceNode,
};

export default function NetworkTopology() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [devices, setDevices] = useState([]);
  const [savedTopologies, setSavedTopologies] = useState([]);
  const [currentTopologyName, setCurrentTopologyName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

  // Fetch monitored devices
  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/agent/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(Array.isArray(data) ? data : (data.value || []));
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const addDeviceNode = (type, icon, label) => {
    const newNode = {
      id: `${Date.now()}`,
      type: 'custom',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { 
        icon, 
        label,
        status: 'offline',
        deviceInfo: null
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addMonitoredDevice = (device) => {
    const status = getDeviceStatus(device.last_seen);
    const newNode = {
      id: `device-${device.device_id}`,
      type: 'custom',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: {
        icon: '💻',
        label: device.hostname || device.device_id,
        status: status.class === 'status-online' ? 'online' : status.class === 'status-idle' ? 'idle' : 'offline',
        deviceInfo: {
          os: device.os_name,
          alerts: 0, // Would fetch from alerts API
          apps: device.app_count
        }
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const getDeviceStatus = (lastSeen) => {
    const now = new Date();
    const last = new Date(lastSeen);
    const diffMinutes = (now - last) / 1000 / 60;
    
    if (diffMinutes < 5) return { class: 'status-online' };
    if (diffMinutes < 30) return { class: 'status-idle' };
    return { class: 'status-offline' };
  };

  const saveTopology = () => {
    const topology = {
      name: currentTopologyName || `Topology ${Date.now()}`,
      nodes,
      edges,
      timestamp: new Date().toISOString()
    };
    
    const saved = JSON.parse(localStorage.getItem('networkTopologies') || '[]');
    saved.push(topology);
    localStorage.setItem('networkTopologies', JSON.stringify(saved));
    setSavedTopologies(saved);
    setShowSaveDialog(false);
    setCurrentTopologyName('');
  };

  const exportAsImage = () => {
    // Would implement canvas export here
    alert('Export feature coming soon!');
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto">
        <h2 className="text-white font-bold text-lg mb-4">Device Palette</h2>
        
        {/* Device Types */}
        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3">Network Devices</h3>
          <div className="space-y-2">
            <button
              onClick={() => addDeviceNode('server', '🖥️', 'Server')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2"
            >
              <Server className="w-4 h-4" />
              Add Server
            </button>
            <button
              onClick={() => addDeviceNode('switch', '🔌', 'Switch')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2"
            >
              <Wifi className="w-4 h-4" />
              Add Switch
            </button>
            <button
              onClick={() => addDeviceNode('workstation', '💻', 'Workstation')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2"
            >
              <Monitor className="w-4 h-4" />
              Add Workstation
            </button>
            <button
              onClick={() => addDeviceNode('firewall', '🔒', 'Firewall')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Add Firewall
            </button>
          </div>
        </div>

        {/* Monitored Devices */}
        {devices.length > 0 && (
          <div>
            <h3 className="text-slate-400 text-sm font-semibold mb-3">Your Monitored Devices</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {devices.map((device) => (
                <button
                  key={device.device_id}
                  onClick={() => addMonitoredDevice(device)}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white p-2 rounded text-xs transition text-left"
                >
                  <div className="font-medium">{device.hostname || device.device_id}</div>
                  <div className="text-blue-300 text-xs">{device.os_name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-900"
        >
          <Controls className="bg-slate-700 border-slate-600" />
          <MiniMap 
            className="bg-slate-800 border-slate-600" 
            nodeColor={(node) => {
              if (node.data.status === 'online') return '#22c55e';
              if (node.data.status === 'idle') return '#eab308';
              return '#ef4444';
            }}
          />
          <Background variant="dots" gap={16} size={1} color="#475569" />
          
          <Panel position="top-right" className="flex gap-2">
            <button
              onClick={() => setShowSaveDialog(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-lg"
            >
              <Save className="w-4 h-4" />
              Save Topology
            </button>
            <button
              onClick={exportAsImage}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-lg"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </Panel>
        </ReactFlow>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 w-96">
              <h3 className="text-white font-bold text-lg mb-4">Save Topology</h3>
              <input
                type="text"
                value={currentTopologyName}
                onChange={(e) => setCurrentTopologyName(e.target.value)}
                placeholder="Enter topology name..."
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={saveTopology}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
