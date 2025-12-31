import React from 'react';
import * as Icons from 'lucide-react';

// Normalize various icon_name forms (e.g., "laptop", "monitor", "hard-drive") to Lucide exports
function resolveIcon(name) {
  if (!name || typeof name !== 'string') return Icons.Box;
  const trimmed = name.trim();
  // Try direct hit first (e.g., Laptop)
  if (Icons[trimmed]) return Icons[trimmed];
  // Convert kebab/underscore/case-insensitive to PascalCase Lucide export name
  const pascal = trimmed
    .split(/[-_\s]+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
  if (Icons[pascal]) return Icons[pascal];
  return Icons.Box;
}

export default function CategoryIcon({ iconName, className = 'w-5 h-5', color }) {
  const IconComponent = resolveIcon(iconName);
  return <IconComponent className={className} style={color ? { color } : undefined} />;
}
