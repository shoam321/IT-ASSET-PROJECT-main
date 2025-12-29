// Asset Category Definitions with Icons
// Categories for IT Asset Management - matches Lucide React icons

export const ASSET_CATEGORIES = [
  {
    id: 'computer',
    label: 'Computer',
    icon: 'Monitor',
    color: 'blue',
    description: 'Desktop computers, workstations'
  },
  {
    id: 'laptop',
    label: 'Laptop',
    icon: 'Laptop',
    color: 'indigo',
    description: 'Portable computers, notebooks'
  },
  {
    id: 'server',
    label: 'Server',
    icon: 'Server',
    color: 'purple',
    description: 'Physical and virtual servers'
  },
  {
    id: 'network-switch',
    label: 'Network Switch',
    icon: 'Network',
    color: 'green',
    description: 'Network switches, hubs'
  },
  {
    id: 'router',
    label: 'Router',
    icon: 'Router',
    color: 'teal',
    description: 'Routers, gateways'
  },
  {
    id: 'cable',
    label: 'Cable',
    icon: 'Cable',
    color: 'gray',
    description: 'Network cables, power cables, HDMI cables'
  },
  {
    id: 'printer',
    label: 'Printer',
    icon: 'Printer',
    color: 'cyan',
    description: 'Printers, scanners, multifunction devices'
  },
  {
    id: 'phone',
    label: 'Phone',
    icon: 'Smartphone',
    color: 'pink',
    description: 'Smartphones, mobile devices'
  },
  {
    id: 'tablet',
    label: 'Tablet',
    icon: 'Tablet',
    color: 'rose',
    description: 'Tablets, iPads'
  },
  {
    id: 'monitor',
    label: 'Monitor',
    icon: 'MonitorSpeaker',
    color: 'violet',
    description: 'Display monitors, screens'
  },
  {
    id: 'keyboard',
    label: 'Keyboard',
    icon: 'Keyboard',
    color: 'slate',
    description: 'Keyboards, keypads'
  },
  {
    id: 'mouse',
    label: 'Mouse',
    icon: 'Mouse',
    color: 'zinc',
    description: 'Computer mice, trackpads'
  },
  {
    id: 'storage',
    label: 'Storage Device',
    icon: 'HardDrive',
    color: 'amber',
    description: 'Hard drives, SSDs, USB drives'
  },
  {
    id: 'ups',
    label: 'UPS/Power',
    icon: 'Zap',
    color: 'yellow',
    description: 'UPS systems, power supplies'
  },
  {
    id: 'camera',
    label: 'Camera',
    icon: 'Camera',
    color: 'red',
    description: 'Security cameras, webcams'
  },
  {
    id: 'headset',
    label: 'Headset',
    icon: 'Headphones',
    color: 'orange',
    description: 'Headsets, speakers, audio equipment'
  },
  {
    id: 'docking-station',
    label: 'Docking Station',
    icon: 'Usb',
    color: 'emerald',
    description: 'Laptop docking stations, hubs'
  },
  {
    id: 'rack',
    label: 'Server Rack',
    icon: 'Container',
    color: 'stone',
    description: 'Server racks, cabinets'
  },
  {
    id: 'access-point',
    label: 'Access Point',
    icon: 'Wifi',
    color: 'sky',
    description: 'WiFi access points, wireless equipment'
  },
  {
    id: 'software',
    label: 'Software License',
    icon: 'Package',
    color: 'fuchsia',
    description: 'Software licenses, applications'
  },
  {
    id: 'cloud',
    label: 'Cloud Service',
    icon: 'Cloud',
    color: 'cyan',
    description: 'Cloud services, SaaS subscriptions'
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'Box',
    color: 'gray',
    description: 'Other IT equipment'
  }
];

// Helper function to get category by id
export function getCategoryById(id) {
  return ASSET_CATEGORIES.find(cat => cat.id === id) || ASSET_CATEGORIES[ASSET_CATEGORIES.length - 1]; // Default to 'Other'
}

// Helper function to get category color classes
export function getCategoryColorClasses(categoryId, variant = 'bg') {
  const category = getCategoryById(categoryId);
  const color = category.color;
  
  const colorMap = {
    bg: {
      blue: 'bg-blue-600',
      indigo: 'bg-indigo-600',
      purple: 'bg-purple-600',
      green: 'bg-green-600',
      teal: 'bg-teal-600',
      gray: 'bg-gray-600',
      cyan: 'bg-cyan-600',
      pink: 'bg-pink-600',
      rose: 'bg-rose-600',
      violet: 'bg-violet-600',
      slate: 'bg-slate-600',
      zinc: 'bg-zinc-600',
      amber: 'bg-amber-600',
      yellow: 'bg-yellow-600',
      red: 'bg-red-600',
      orange: 'bg-orange-600',
      emerald: 'bg-emerald-600',
      stone: 'bg-stone-600',
      sky: 'bg-sky-600',
      fuchsia: 'bg-fuchsia-600'
    },
    text: {
      blue: 'text-blue-400',
      indigo: 'text-indigo-400',
      purple: 'text-purple-400',
      green: 'text-green-400',
      teal: 'text-teal-400',
      gray: 'text-gray-400',
      cyan: 'text-cyan-400',
      pink: 'text-pink-400',
      rose: 'text-rose-400',
      violet: 'text-violet-400',
      slate: 'text-slate-400',
      zinc: 'text-zinc-400',
      amber: 'text-amber-400',
      yellow: 'text-yellow-400',
      red: 'text-red-400',
      orange: 'text-orange-400',
      emerald: 'text-emerald-400',
      stone: 'text-stone-400',
      sky: 'text-sky-400',
      fuchsia: 'text-fuchsia-400'
    },
    badge: {
      blue: 'bg-blue-900 text-blue-200',
      indigo: 'bg-indigo-900 text-indigo-200',
      purple: 'bg-purple-900 text-purple-200',
      green: 'bg-green-900 text-green-200',
      teal: 'bg-teal-900 text-teal-200',
      gray: 'bg-gray-900 text-gray-200',
      cyan: 'bg-cyan-900 text-cyan-200',
      pink: 'bg-pink-900 text-pink-200',
      rose: 'bg-rose-900 text-rose-200',
      violet: 'bg-violet-900 text-violet-200',
      slate: 'bg-slate-900 text-slate-200',
      zinc: 'bg-zinc-900 text-zinc-200',
      amber: 'bg-amber-900 text-amber-200',
      yellow: 'bg-yellow-900 text-yellow-200',
      red: 'bg-red-900 text-red-200',
      orange: 'bg-orange-900 text-orange-200',
      emerald: 'bg-emerald-900 text-emerald-200',
      stone: 'bg-stone-900 text-stone-200',
      sky: 'bg-sky-900 text-sky-200',
      fuchsia: 'bg-fuchsia-900 text-fuchsia-200'
    }
  };
  
  return colorMap[variant]?.[color] || colorMap[variant].gray;
}
