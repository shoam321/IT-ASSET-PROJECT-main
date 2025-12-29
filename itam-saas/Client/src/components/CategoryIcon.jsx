import React from 'react';
import { 
  Monitor, Laptop, Server, Network, Router, Cable, Printer, 
  Smartphone, Tablet, MonitorSpeaker, Keyboard, Mouse, HardDrive, 
  Zap, Camera, Headphones, Dock, Container, Wifi, Package, Cloud, Box 
} from 'lucide-react';

// Map icon names to actual icon components
const iconMap = {
  Monitor, 
  Laptop, 
  Server, 
  Network, 
  Router, 
  Cable, 
  Printer,
  Smartphone, 
  Tablet, 
  MonitorSpeaker, 
  Keyboard, 
  Mouse, 
  HardDrive,
  Zap, 
  Camera, 
  Headphones, 
  Dock, 
  Container, 
  Wifi, 
  Package, 
  Cloud, 
  Box
};

export default function CategoryIcon({ iconName, className = "w-5 h-5", color }) {
  const IconComponent = iconMap[iconName] || Box;
  return <IconComponent className={className} style={color ? { color } : undefined} />;
}
