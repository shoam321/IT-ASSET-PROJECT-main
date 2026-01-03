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
  Handle,
  Position,
  useReactFlow,
} from '@xyflow/react';
import { Save, Download, Plus, Server, Monitor, Wifi, Shield, AlignLeft, Grid3x3, FolderOpen, Layers } from 'lucide-react';
import '@xyflow/react/dist/style.css';

const SNAP_GRID = [20, 20]; // Snap to 20px grid
const MIN_DISTANCE = 150; // Minimum distance between nodes (increased padding)

const CustomDeviceNode = ({ data }) => {
  const getStatusColor = (status) => {
    if (status === 'online') return 'bg-green-500';
    if (status === 'idle') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusGlow = (status) => {
    if (status === 'online') return 'shadow-green-500/50';
    if (status === 'idle') return 'shadow-yellow-500/50';
    return 'shadow-red-500/50';
  };

  return (
    <div className="bg-gradient-to-br from-pink-600 via-purple-600 to-cyan-600 border-8 border-yellow-400 rounded-3xl p-8 min-w-[300px] shadow-[0_0_80px_rgba(255,0,255,0.9)] hover:shadow-[0_0_120px_rgba(0,255,255,1)] hover:border-lime-400 transition-all duration-300 hover:scale-125 transform animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-8 h-8 rounded-full ${getStatusColor(data.status)} ${getStatusGlow(data.status)} shadow-[0_0_40px] ${data.status === 'online' ? 'animate-ping' : 'animate-pulse'}`}></div>
        <span className="text-6xl drop-shadow-[0_0_20px_rgba(255,255,0,1)] animate-bounce filter brightness-150">{data.icon}</span>
        <span className="text-white font-black text-2xl tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,1)]">{data.label}</span>
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
      {/* Connection handles - React Flow Handle components */}
      <Handle type="source" position={Position.Left} id="left" className="w-3 h-3 bg-blue-500" />
      <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-blue-500" />
      <Handle type="source" position={Position.Top} id="top" className="w-3 h-3 bg-blue-500" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-blue-500" />
      <Handle type="target" position={Position.Left} id="left-target" className="w-3 h-3 bg-blue-500" />
      <Handle type="target" position={Position.Right} id="right-target" className="w-3 h-3 bg-blue-500" />
      <Handle type="target" position={Position.Top} id="top-target" className="w-3 h-3 bg-blue-500" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="w-3 h-3 bg-blue-500" />
    </div>
  );
};

const GroupNode = ({ data }) => {
  return (
    <div className="bg-slate-800/30 border-2 border-dashed border-cyan-400/50 rounded-2xl p-6 min-w-[400px] min-h-[300px] backdrop-blur-sm">
      {data.label && (
        <div className="absolute -top-3 left-4 bg-cyan-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
          {data.label}
        </div>
      )}
      <div className="text-slate-400 text-xs text-center mt-2">
        {data.description || 'Network Zone'}
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomDeviceNode,
  group: GroupNode,
};

const ZoomSlider = () => {
  const { zoomIn, zoomOut, setViewport, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setZoom(getZoom());
    }, 100);
    return () => clearInterval(interval);
  }, [getZoom]);

  const handleZoomChange = (e) => {
    const newZoom = parseFloat(e.target.value);
    setViewport({ x: 0, y: 0, zoom: newZoom }, { duration: 200 });
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-600 rounded-lg p-3 shadow-xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => zoomOut()}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center justify-center transition"
        >
          -
        </button>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.1"
          value={zoom}
          onChange={handleZoomChange}
          className="w-32 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <button
          onClick={() => zoomIn()}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center justify-center transition"
        >
          +
        </button>
        <span className="text-white text-sm font-mono w-12">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
};

// Connection type styles
const connectionTypes = {
  ethernet: { 
    label: '🔵 Ethernet', 
    color: '#00ffff', 
    style: { strokeWidth: 10, stroke: '#00ffff', filter: 'drop-shadow(0 0 20px #00ffff) drop-shadow(0 0 40px #00ffff)' },
    animated: true
  },
  fiber: { 
    label: '🟢 Fiber Optic', 
    color: '#00ff00', 
    style: { strokeWidth: 12, stroke: '#00ff00', filter: 'drop-shadow(0 0 25px #00ff00) drop-shadow(0 0 50px #00ff00)' },
    animated: true
  },
  wifi: { 
    label: '📡 WiFi', 
    color: '#ff00ff', 
    style: { strokeWidth: 8, stroke: '#ff00ff', strokeDasharray: '15,5', filter: 'drop-shadow(0 0 20px #ff00ff) drop-shadow(0 0 35px #ff00ff)' },
    animated: true
  },
  vpn: { 
    label: '🔒 VPN', 
    color: '#ff0099', 
    style: { strokeWidth: 10, stroke: '#ff0099', filter: 'drop-shadow(0 0 20px #ff0099) drop-shadow(0 0 40px #ff0099)' },
    animated: true
  },
  power: { 
    label: '⚡ Power', 
    color: '#ffff00', 
    style: { strokeWidth: 8, stroke: '#ffff00', strokeDasharray: '10,3', filter: 'drop-shadow(0 0 20px #ffff00) drop-shadow(0 0 35px #ffff00)' },
    animated: true
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
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/devices`, {
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
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  // Fetch monitored devices and load saved topologies
  useEffect(() => {
    fetchDevices();
    const saved = JSON.parse(localStorage.getItem('networkTopologies') || '[]');
    setSavedTopologies(saved);
  }, [fetchDevices]);

  // Auto-save topology changes
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const autoSaveTimer = setTimeout(() => {
        const currentState = { nodes, edges, name: currentTopologyName || 'Auto-saved' };
        localStorage.setItem('topologyAutoSave', JSON.stringify(currentState));
      }, 2000);
      return () => clearTimeout(autoSaveTimer);
    }
  }, [nodes, edges, currentTopologyName]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Delete key - remove selected nodes/edges
      if (e.key === 'Delete' && selectedNodes.length > 0) {
        setNodes((nds) => nds.filter(n => !selectedNodes.includes(n.id)));
        setEdges((eds) => eds.filter(e => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target)));
        setSelectedNodes([]);
      }
      // Ctrl+A - select all nodes
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedNodes(nodes.map(n => n.id));
      }
      // Escape - clear selection
      if (e.key === 'Escape') {
        setSelectedNodes([]);
        setShowEdgePanel(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, selectedNodes, setNodes, setEdges]);

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
  }, [onNodesChange, setNodes]);

  const onConnect = useCallback(
    (params) => {
      const connectionStyle = connectionTypes[connectionType];
      const newEdge = {
        ...params, 
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        type: 'default',
        animated: connectionStyle.animated,
        style: { ...connectionStyle.style },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: connectionStyle.color,
        },
        data: { type: connectionType, label: '' }
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [connectionType, setEdges]
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
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addGroupNode = (label, description) => {
    const newNode = {
      id: `group-${Date.now()}`,
      type: 'group',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
      data: { 
        label,
        description
      },
      style: {
        width: 400,
        height: 300,
        zIndex: -1,
      }
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

  const exportAsImage = async () => {
    try {
      const { toPng } = await import('html-to-image');
      const element = document.querySelector('.react-flow');
      if (!element) return;
      
      const dataUrl = await toPng(element, {
        backgroundColor: '#0f172a',
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
      
      const link = document.createElement('a');
      link.download = `topology-${currentTopologyName || Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  const loadTopology = (topology) => {
    setNodes(topology.nodes);
    setEdges(topology.edges);
    setCurrentTopologyName(topology.name);
    setShowLoadDialog(false);
  };

  const deleteTopology = (index) => {
    const saved = [...savedTopologies];
    saved.splice(index, 1);
    localStorage.setItem('networkTopologies', JSON.stringify(saved));
    setSavedTopologies(saved);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      {/* Sidebar */}
      <div className="w-72 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto shadow-2xl">
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          Network Planner
        </h2>
        
        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
          />
        </div>
        
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

        {/* Network Zones/Groups */}
        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            Network Zones
          </h3>
          <div className="space-y-2">
            <button
              onClick={() => addGroupNode('DMZ', 'Demilitarized Zone')}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white p-2 rounded-lg transition flex items-center gap-2 text-xs"
            >
              <Layers className="w-3 h-3" />
              Add DMZ Zone
            </button>
            <button
              onClick={() => addGroupNode('Internal', 'Internal Network')}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white p-2 rounded-lg transition flex items-center gap-2 text-xs"
            >
              <Layers className="w-3 h-3" />
              Add Internal Zone
            </button>
            <button
              onClick={() => addGroupNode('Cloud', 'Cloud Infrastructure')}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white p-2 rounded-lg transition flex items-center gap-2 text-xs"
            >
              <Layers className="w-3 h-3" />
              Add Cloud Zone
            </button>
            <button
              onClick={() => addGroupNode('Guest', 'Guest Network')}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white p-2 rounded-lg transition flex items-center gap-2 text-xs"
            >
              <Layers className="w-3 h-3" />
              Add Guest Zone
            </button>
          </div>
        </div>
        
        {/* Device Types */}
        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3">End Devices</h3>
          <div className="space-y-2">
            <button
              onClick={() => addDeviceNode('pc', '💻', 'PC')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Monitor className="w-4 h-4" />
              Add PC
            </button>
            <button
              onClick={() => addDeviceNode('laptop', '💼', 'Laptop')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Monitor className="w-4 h-4" />
              Add Laptop
            </button>
            <button
              onClick={() => addDeviceNode('printer', '🖨️', 'Printer')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Printer
            </button>
            <button
              onClick={() => addDeviceNode('scanner', '📷', 'Scanner')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Scanner
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3">Network Devices</h3>
          <div className="space-y-2">
            <button
              onClick={() => addDeviceNode('lan-switch', '🔌', 'LAN Switch')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Wifi className="w-4 h-4" />
              Add LAN Switch
            </button>
            <button
              onClick={() => addDeviceNode('wan-router', '🌐', 'WAN Router')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Server className="w-4 h-4" />
              Add WAN Router
            </button>
            <button
              onClick={() => addDeviceNode('firewall', '🔒', 'Firewall')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Shield className="w-4 h-4" />
              Add Firewall
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3">Data Infrastructure</h3>
          <div className="space-y-2">
            <button
              onClick={() => addDeviceNode('database', '🗄️', 'Database Server')}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Server className="w-4 h-4" />
              Add Database
            </button>
            <button
              onClick={() => addDeviceNode('storage', '💾', 'Storage Array')}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Server className="w-4 h-4" />
              Add Storage
            </button>
            <button
              onClick={() => addDeviceNode('backup', '📦', 'Backup Server')}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Server className="w-4 h-4" />
              Add Backup
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3">Servers</h3>
          <div className="space-y-2">
            <button
              onClick={() => addDeviceNode('web-server', '🌐', 'Web Server')}
              className="w-full bg-green-700 hover:bg-green-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Server className="w-4 h-4" />
              Add Web Server
            </button>
            <button
              onClick={() => addDeviceNode('app-server', '⚙️', 'App Server')}
              className="w-full bg-green-700 hover:bg-green-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Server className="w-4 h-4" />
              Add App Server
            </button>
            <button
              onClick={() => addDeviceNode('mail-server', '📧', 'Mail Server')}
              className="w-full bg-green-700 hover:bg-green-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Server className="w-4 h-4" />
              Add Mail Server
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3">Security & Monitoring</h3>
          <div className="space-y-2">
            <button
              onClick={() => addDeviceNode('ids', '🛡️', 'IDS/IPS')}
              className="w-full bg-red-700 hover:bg-red-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Shield className="w-4 h-4" />
              Add IDS/IPS
            </button>
            <button
              onClick={() => addDeviceNode('monitoring', '📊', 'Monitoring')}
              className="w-full bg-red-700 hover:bg-red-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Monitor className="w-4 h-4" />
              Add Monitoring
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3">Cloud Services</h3>
          <div className="space-y-2">
            <button
              onClick={() => addDeviceNode('cloud', '☁️', 'Cloud Service')}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Wifi className="w-4 h-4" />
              Add Cloud
            </button>
            <button
              onClick={() => addDeviceNode('saas', '🌟', 'SaaS Platform')}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Server className="w-4 h-4" />
              Add SaaS
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-slate-400 text-sm font-semibold mb-3">Infrastructure</h3>
          <div className="space-y-2">
            <button
              onClick={() => addDeviceNode('server', '🖥️', 'Generic Server')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <Server className="w-4 h-4" />
              Add Server
            </button>
          </div>
        </div>

        {/* Monitored Devices */}
        {devices.length > 0 && (
          <div>
            <h3 className="text-slate-400 text-sm font-semibold mb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-green-400" />
              Your Monitored Devices {loading && <span className="text-xs text-blue-400 animate-pulse">Loading...</span>}
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {devices
                .filter(d => !searchQuery || d.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) || d.os_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((device) => (
                  <button
                    key={device.device_id}
                    onClick={() => addMonitoredDevice(device)}
                    className="w-full bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white p-2 rounded-lg text-xs transition text-left shadow-lg hover:shadow-blue-500/30 border border-blue-700"
                  >
                    <div className="font-medium flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                      {device.hostname || device.device_id}
                    </div>
                    <div className="text-blue-300 text-xs mt-1">{device.os_name}</div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {loading && devices.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-slate-400 text-sm animate-pulse">Loading devices...</div>
          </div>
        )}
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative overflow-hidden bg-slate-900">
        {loading && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-slate-900/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg font-semibold">Loading Network Topology...</p>
            </div>
          </div>
        )}
        <div className="relative z-10 h-full">
          <ReactFlow
            nodes={nodes.map(node => ({
              ...node,
              className: selectedNodes.includes(node.id) ? 'ring-4 ring-blue-500' : '',
              style: {
                ...node.style,
                filter: searchQuery && !node.data.label.toLowerCase().includes(searchQuery.toLowerCase()) ? 'opacity(0.3)' : 'opacity(1)',
              }
            }))}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onNodeClick={(e, node) => {
              if (e.ctrlKey || e.metaKey) {
                setSelectedNodes(prev => 
                  prev.includes(node.id) ? prev.filter(id => id !== node.id) : [...prev, node.id]
                );
              } else {
                setSelectedNodes([node.id]);
              }
            }}
            onPaneClick={() => setSelectedNodes([])}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={SNAP_GRID}
            fitView
            connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 3, filter: 'drop-shadow(0 0 4px #3b82f6)' }}
            connectionMode="loose"
            className="bg-transparent"
          >
          <Background color="#1e293b" gap={20} size={1} />
          <Controls 
            position="top-right"
            className="bg-slate-700/90 border-slate-600 rounded-lg shadow-xl backdrop-blur-sm"
            style={{ zIndex: 10 }}
            showZoom={false}
            showFitView={true}
            showInteractive={true}
          />
          
          <Panel position="top-right" className="mt-16">
            <ZoomSlider />
          </Panel>
          
          <MiniMap 
            className="bg-slate-800 border-slate-600" 
            nodeColor={(node) => {
              if (node.data.status === 'online') return '#22c55e';
              if (node.data.status === 'idle') return '#eab308';
              return '#ef4444';
            }}
          />
          
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
          
          <Panel position="bottom-left" className="flex gap-2 mb-2 ml-2">
            <button
              onClick={() => setShowLoadDialog(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition shadow-lg text-sm"
            >
              <FolderOpen className="w-4 h-4" />
              Load ({savedTopologies.length})
            </button>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition shadow-lg text-sm"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={exportAsImage}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition shadow-lg text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </Panel>
          </ReactFlow>
        </div>

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

        {/* Load Dialog */}
        {showLoadDialog && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 w-[500px] max-h-[600px] overflow-y-auto">
              <h3 className="text-white font-bold text-lg mb-4">Saved Topologies</h3>
              {savedTopologies.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No saved topologies yet</p>
              ) : (
                <div className="space-y-2">
                  {savedTopologies.map((topology, index) => (
                    <div key={index} className="bg-slate-700 border border-slate-600 rounded-lg p-4 hover:border-purple-500 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold">{topology.name}</h4>
                          <p className="text-slate-400 text-xs mt-1">
                            {new Date(topology.timestamp).toLocaleString()}
                          </p>
                          <p className="text-slate-400 text-xs mt-1">
                            {topology.nodes.length} devices, {topology.edges.length} connections
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadTopology(topology)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => deleteTopology(index)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowLoadDialog(false)}
                className="w-full mt-4 bg-slate-600 hover:bg-slate-500 text-white py-2 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
