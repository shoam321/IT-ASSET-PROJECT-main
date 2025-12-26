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
  MarkerType,
} from '@xyflow/react';
import { Save, Download, Plus, Server, Monitor, Wifi, Shield, AlignLeft, Grid3x3 } from 'lucide-react';
import '@xyflow/react/dist/style.css';

const SNAP_GRID = [20, 20]; // Snap to 20px grid
const MIN_DISTANCE = 100; // Minimum distance between nodes

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

// Connection type styles
const connectionTypes = {
  ethernet: { 
    label: '🔵 Ethernet', 
    color: '#3b82f6', 
    style: { strokeWidth: 2, stroke: '#3b82f6' },
    animated: false
  },
  fiber: { 
    label: '🟢 Fiber Optic', 
    color: '#22c55e', 
    style: { strokeWidth: 3, stroke: '#22c55e' },
    animated: true
  },
  wifi: { 
    label: '📡 WiFi', 
    color: '#f97316', 
    style: { strokeWidth: 2, stroke: '#f97316', strokeDasharray: '5,5' },
    animated: false
  },
  vpn: { 
    label: '🔒 VPN', 
    color: '#a855f7', 
    style: { strokeWidth: 2, stroke: '#a855f7' },
    animated: true
  },
  power: { 
    label: '⚡ Power', 
    color: '#eab308', 
    style: { strokeWidth: 2, stroke: '#eab308' },
    animated: false
  },
};

export default function NetworkTopology() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [devices, setDevices] = useState([]);
  const [savedTopologies, setSavedTopologies] = useState([]);
  const [currentTopologyName, setCurrentTopologyName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [connectionType, setConnectionType] = useState('ethernet');
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [showEdgePanel, setShowEdgePanel] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

  // Fetch monitored devices
  useEffect(() => {
    fetchDevices();
  }, []);

  // Custom node change handler with collision prevention
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    
    // After position changes, check and resolve collisions
    if (changes.some(change => change.type === 'position' && !change.dragging)) {
      setNodes((currentNodes) => {
        const adjustedNodes = [...currentNodes];
        
        // Check each node against others
        for (let i = 0; i < adjustedNodes.length; i++) {
          for (let j = i + 1; j < adjustedNodes.length; j++) {
            const node1 = adjustedNodes[i];
            const node2 = adjustedNodes[j];
            
            if (!node1.position || !node2.position) continue;
            
            const dx = node1.position.x - node2.position.x;
            const dy = node1.position.y - node2.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If too close, push them apart
            if (distance < MIN_DISTANCE) {
              const angle = Math.atan2(dy, dx);
              const pushDistance = (MIN_DISTANCE - distance) / 2;
              
              // Push both nodes away from each other
              adjustedNodes[i] = {
                ...node1,
                position: {
                  x: node1.position.x + Math.cos(angle) * pushDistance,
                  y: node1.position.y + Math.sin(angle) * pushDistance,
                }
              };
              
              adjustedNodes[j] = {
                ...node2,
                position: {
                  x: node2.position.x - Math.cos(angle) * pushDistance,
                  y: node2.position.y - Math.sin(angle) * pushDistance,
                }
              };
            }
          }
        }
        
        return adjustedNodes;
      });
    }
  }, [onNodesChange]);

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
    (params) => {
      const connectionStyle = connectionTypes[connectionType];
      setEdges((eds) => addEdge({ 
        ...params, 
        animated: connectionStyle.animated,
        style: connectionStyle.style,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: connectionStyle.color,
        },
        data: { type: connectionType, label: '' }
      }, eds));
    },
    [setEdges, connectionType]
  );

  const onEdgeClick = useCallback((event, edge) => {
    setSelectedEdge(edge);
    setShowEdgePanel(true);
  }, []);

  const deleteEdge = () => {
    if (selectedEdge) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
      setShowEdgePanel(false);
      setSelectedEdge(null);
    }
  };

  const updateEdgeLabel = (label) => {
    if (selectedEdge) {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdge.id ? { ...e, label, labelStyle: { fill: '#fff', fontWeight: 600 } } : e
        )
      );
    }
  };

  const autoArrange = () => {
    const arranged = nodes.map((node, idx) => {
      const row = Math.floor(idx / 4);
      const col = idx % 4;
      return {
        ...node,
        position: { x: col * 250 + 100, y: row * 200 + 100 }
      };
    });
    setNodes(arranged);
  };

  const alignHorizontally = () => {
    if (nodes.length === 0) return;
    const avgY = nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length;
    setNodes(nodes.map(n => ({ ...n, position: { ...n.position, y: avgY } })));
  };

  const alignVertically = () => {
    if (nodes.length === 0) return;
    const avgX = nodes.reduce((sum, n) => sum + n.position.x, 0) / nodes.length;
    setNodes(nodes.map(n => ({ ...n, position: { ...n.position, x: avgX } })));
  };

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
      <div className="w-72 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto">
        <h2 className="text-white font-bold text-lg mb-4">Device Palette</h2>
        
        {/* Connection Type Selector */}
        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3">Connection Type</h3>
          <select
            value={connectionType}
            onChange={(e) => setConnectionType(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
          >
            {Object.entries(connectionTypes).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-2">Draw connections with selected type</p>
        </div>
        
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
        {devices.length >handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          snapToGrid={true}
          snapGrid={SNAP_GRID}
          fitView
          className="bg-slate-900"
        >
          <Controls className="bg-slate-700 border-slate-600" />
          <MiniMap 
            className="bg-slate-800 border-slate-600" 
            nodeColor={(node) => {
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
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          snapToGrid={true}
          snapGrid={SNAP_GRID}
          fitView
          className="bg-slate-900"
        >
          <Controls className="bg-slate-700 border-slate-600" />
          <MiniMap 
            className="bg-slate-800 border-slate-600" 
            nodeColor={(node) => {
              if (node.data.overlapping) return '#ef4444';
              if (node.data.status === 'online') return '#22c55e';
              if (node.data.status === 'idle') return '#eab308';
              return '#ef4444';
            }}
          />
          <Background variant="dots" gap={16} size={1} color="#475569" />
          
          <Panel position="top-left" className="flex flex-col gap-2">
            <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
              <h3 className="text-white text-sm font-semibold mb-2">Layout Tools</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={autoArrange}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded text-xs transition flex items-center gap-2"
                >
                  <Grid3x3 className="w-3 h-3" />
                  Auto Arrange
                </button>
                <button
                  onClick={alignHorizontally}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded text-xs transition flex items-center gap-2"
                >
                  <AlignLeft className="w-3 h-3" />
                  Align Horizontal
                </button>
                <button
                  onClick={alignVertically}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded text-xs transition flex items-center gap-2"
                >
                  <AlignLeft className="w-3 h-3 rotate-90" />
                  Align Vertical
                </button>
              </div>
            </div>
          </Panel>
          
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

        {/* Edge Edit Panel */}
        {showEdgePanel && selectedEdge && (
          <div className="absolute top-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-4 w-80 z-50 shadow-2xl">
            <h3 className="text-white font-bold mb-3">Connection Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-slate-300 text-sm mb-1 block">Connection Label</label>
                <input
                  type="text"
                  placeholder="e.g., 1 Gbps, VLAN 100"
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm"
                  onChange={(e) => updateEdgeLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-slate-300 text-sm mb-1 block">Connection Type</label>
                <div className="text-sm text-slate-400">
                  {connectionTypes[selectedEdge.data?.type || 'ethernet'].label}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={deleteEdge}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded transition"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowEdgePanel(false)}
                  className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 rounded transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

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
