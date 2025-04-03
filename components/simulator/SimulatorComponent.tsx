"use client";
import React, { useState, useMemo, useCallback } from 'react';
import { useSimulation } from "@/hooks/useSimulation";
import CoordinateTable from '@/components/data/CoordinateTable';
import FileImport from '@/components/data/FileImport';
import SearchControl from '@/components/map/SearchControl';
// Import MapWrapper instead of LeafletMap
import MapWrapper from '@/components/simulator/MapWrapper';
import DroneSimulator from '@/components/simulator/DroneSimulator';
import { Coordinate } from '@/lib/api';

const SimulatorComponent: React.FC = () => {
  const [centerMapOn, setCenterMapOn] = useState<Coordinate | null>(null);
  
  const {
    waypoints,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    stopSimulation,
    updateSpeed,
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    clearWaypoints,
    setAllWaypoints,
    isActive,
    isPaused,
    currentPosition,
    progress,
    speed
  } = useSimulation();
  
  // Create a memoized copy of waypoints that we'll pass to the map
  // This will update whenever waypoints changes, but won't cause re-renders during simulation
  const staticWaypoints = useMemo(() => [...waypoints], [waypoints]);
  
  const handleLocationSelect = (location: { lat: number; lng: number; name: string }) => {
    // Center the map on the selected location
    setCenterMapOn({ lat: location.lat, lng: location.lng });
  };
  
  // Use useCallback to memoize the handleMapClick function
  const handleMapClick = useCallback((position: { lat: number; lng: number }) => {
    if (!isActive) {
      addWaypoint(position);
    }
  }, [isActive, addWaypoint]);
  
  const handleImportSuccess = (coordinates: Coordinate[]) => {
    setAllWaypoints(coordinates);
    
    // Center the map on the first waypoint if available
    if (coordinates.length > 0) {
      setCenterMapOn(coordinates[0]);
    }
  };

  // Memoize the map props to prevent unnecessary re-renders during simulation
  const mapProps = useMemo(() => ({
    waypoints: staticWaypoints,
    onMapClick: handleMapClick,
    centerOn: centerMapOn || undefined,
    disabled: isActive,
    simulationMarker: currentPosition
  }), [staticWaypoints, handleMapClick, centerMapOn, isActive, currentPosition]);
  
  return (
    <div className="simulator-container max-w-screen-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-amber-500">Drone Flight Simulator</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Controls and Data */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold mb-4">Location Search</h2>
            <SearchControl 
              onSelectLocation={handleLocationSelect} 
              disabled={isActive}
            />
          </div>
          
          <div className="bg-white p-4 rounded shadow">
            <FileImport 
              onImportSuccess={handleImportSuccess}
              disabled={isActive}
            />
          </div>
          
          {/* DroneSimulator - use the actual waypoints and currentPosition */}
          <div className="bg-white p-4 rounded shadow">
            <DroneSimulator
              waypoints={waypoints}
              currentPosition={currentPosition}
              isActive={isActive}
              isPaused={isPaused}
              progress={progress || 0}
              speed={speed}
              onStart={startSimulation}
              onPause={pauseSimulation}
              onResume={resumeSimulation}
              onStop={stopSimulation}
              onSpeedChange={updateSpeed}
              onClearWaypoints={clearWaypoints}
              disabled={waypoints.length < 2}
            />
          </div>
        </div>
        
        {/* Right Column - Map and Waypoints */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold mb-4">Flight Map</h2>
            {/* Use MapWrapper instead of LeafletMap */}
            <MapWrapper {...mapProps} />
            <p className="mt-2 text-sm text-gray-600">
              {!isActive ? "Click on the map to add waypoints" : "Simulation in progress (map shows planned waypoints)"}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded shadow">
            <CoordinateTable
              coordinates={waypoints}
              onAddCoordinate={addWaypoint}
              onUpdateCoordinate={updateWaypoint}
              onRemoveCoordinate={removeWaypoint}
              onClearCoordinates={clearWaypoints}
              disabled={isActive}
            />
          </div>
        </div>
      </div>
      
      {isActive && currentPosition && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-medium">Current Drone Position:</h3>
          <p>Latitude: {currentPosition.lat.toFixed(6)}, Longitude: {currentPosition.lng.toFixed(6)}</p>
        </div>
      )}
    </div>
  );
};

export default SimulatorComponent;