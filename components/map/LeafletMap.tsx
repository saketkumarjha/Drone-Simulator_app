import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { Coordinate } from '@/lib/api';
import type L from 'leaflet';

interface LeafletMapProps {
  waypoints: Coordinate[];
  onMapClick?: (position: { lat: number; lng: number }) => void;
  centerOn?: Coordinate;
  disabled?: boolean;
  simulationMarker?: Coordinate | null;
}

const LeafletMap: React.FC<LeafletMapProps> = ({
  waypoints,
  onMapClick,
  centerOn,
  disabled = false,
  simulationMarker = null
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);
  const pathLayerRef = useRef<L.Polyline | null>(null);
  const simulationMarkerRef = useRef<L.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [storedWaypoints, setStoredWaypoints] = useState<Coordinate[]>([]);

  // Dynamically import Leaflet only on client-side
  useEffect(() => {
    // This ensures we only run this code on the client
    if (typeof window === 'undefined') return;
    
    import('leaflet').then((leaflet) => {
      const L = leaflet;
      
      // Fix for Leaflet icon issues in webpack builds
      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
      
      initializeMap(L);
    });
    
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Initialize the map
  const initializeMap = (L: typeof import('leaflet')) => {
    if (!mapContainerRef.current) return;
    
    try {
      const map = L.map(mapContainerRef.current, {
        fadeAnimation: false,
        zoomAnimation: false
      }).setView([51.505, -0.09], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      
      map.whenReady(() => {
        // Only add click handlers if onMapClick is provided
        if (onMapClick) {
          map.on('click', (e: L.LeafletMouseEvent) => {
            // Only process clicks when not disabled
            if (!disabled) {
              onMapClick({
                lat: e.latlng.lat,
                lng: e.latlng.lng
              });
            }
          });
        }
        
        setMapReady(true);
      });
      
      mapRef.current = map;
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  };

  // Store waypoints when they change
  useEffect(() => {
    if (waypoints && waypoints.length > 0) {
      setStoredWaypoints(waypoints);
    }
  }, [waypoints]);
  
  // Update waypoints and paths on the map
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapRef.current || !mapReady) return;
    
    import('leaflet').then((leaflet) => {
      const L = leaflet.default;
      const map = mapRef.current;
      if (!map) return;
      
      // Clear existing waypoint markers
      waypointMarkersRef.current.forEach(marker => marker.remove());
      waypointMarkersRef.current = [];
      
      // Remove existing path
      if (pathLayerRef.current) {
        pathLayerRef.current.remove();
        pathLayerRef.current = null;
      }
      
      // Use stored waypoints to ensure visibility during simulation
      const displayWaypoints = storedWaypoints.length > 0 ? storedWaypoints : waypoints;
      
      // Only proceed if we have waypoints
      if (!displayWaypoints || displayWaypoints.length === 0) return;
      
      try {
        // Add waypoint markers
        const newMarkers = displayWaypoints.map((waypoint, index) => {
          if (!waypoint || typeof waypoint.lat !== 'number' || typeof waypoint.lng !== 'number') {
            console.warn('Invalid waypoint detected:', waypoint);
            return null;
          }
          
          const marker = L.marker([waypoint.lat, waypoint.lng], {
            title: `Waypoint ${index + 1}`,
            autoPan: false
          }).addTo(map);
          
          marker.bindPopup(`<b>Waypoint ${index + 1}</b><br>Lat: ${waypoint.lat.toFixed(6)}<br>Lng: ${waypoint.lng.toFixed(6)}`);
          return marker;
        }).filter((marker): marker is L.Marker => marker !== null);
        
        waypointMarkersRef.current = newMarkers;
        
        // Create path between waypoints if more than one waypoint exists
        if (displayWaypoints.length >= 2) {
          const validWaypoints = displayWaypoints.filter(wp => 
            wp && typeof wp.lat === 'number' && typeof wp.lng === 'number'
          );
          const latlngs = validWaypoints.map(wp => L.latLng(wp.lat, wp.lng));
          
          if (latlngs.length >= 2) {
            pathLayerRef.current = L.polyline(latlngs, {
              color: 'blue',
              weight: 3,
              opacity: 0.7,
              dashArray: '5, 10'
            }).addTo(map);
            
            // Fit bounds only if we have multiple waypoints and aren't explicitly centering
            if (!centerOn) {
              map.fitBounds(pathLayerRef.current.getBounds(), {
                padding: [50, 50],
                maxZoom: 15
              });
            }
          }
        } else if (displayWaypoints.length === 1 && !centerOn) {
          // If there's just one waypoint, center on it
          map.setView([displayWaypoints[0].lat, displayWaypoints[0].lng], 13);
        }
      } catch (error) {
        console.error("Error updating waypoints:", error);
      }
    });
  }, [storedWaypoints, waypoints, mapReady, centerOn]);

  // Update simulation marker position
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapRef.current || !mapReady || !simulationMarker) {
      if (simulationMarkerRef.current) {
        simulationMarkerRef.current.remove();
        simulationMarkerRef.current = null;
      }
      return;
    }

    import('leaflet').then((leaflet) => {
      const L = leaflet.default;
      const map = mapRef.current;
      if (!map) return;
      
      try {
        if (simulationMarkerRef.current) {
          simulationMarkerRef.current.setLatLng([simulationMarker.lat, simulationMarker.lng]);
        } else {
          simulationMarkerRef.current = L.marker([simulationMarker.lat, simulationMarker.lng], {
            icon: L.divIcon({
              className: 'simulation-marker',
              html: '🚁',
              iconSize: [25, 25],
              iconAnchor: [12, 12]
            })
          }).addTo(map);
        }
      } catch (error) {
        console.error("Error updating simulation marker:", error);
      }
    });
  }, [simulationMarker, mapReady]);
  
  // Handle explicit map centering
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapRef.current || !centerOn || !mapReady) return;
    
    try {
      mapRef.current.setView([centerOn.lat, centerOn.lng], 13, {
        animate: true,
        duration: 0.5
      });
    } catch (error) {
      console.error("Error centering map:", error);
    }
  }, [centerOn, mapReady]);
  
  return (
    <div className="relative">
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '500px' }}
        className="leafmap-container border rounded shadow-md"
        data-loading={!mapReady}
      >
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70">
            <span className="text-gray-600">Loading map...</span>
          </div>
        )}
      </div>
      {disabled && (
        <div className="absolute inset-0 bg-gray-200 bg-opacity-30 pointer-events-none z-10"></div>
      )}
    </div>
  );
};

export default LeafletMap;