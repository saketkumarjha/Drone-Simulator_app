"use client";
// src/components/simulator/DroneSimulator.tsx
import React, { useEffect, useRef } from 'react';
import { Coordinate } from '@/lib/api';

interface DroneSimulatorProps {
  waypoints: Coordinate[];
  currentPosition: Coordinate | null;
  isActive: boolean;
  isPaused: boolean;
  progress: number;
  speed: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onClearWaypoints: () => void;
  disabled?: boolean;
}

const DroneSimulator: React.FC<DroneSimulatorProps> = ({
  waypoints,
  currentPosition,
  isActive,
  isPaused,
  progress,
  speed,
  onStart,
  onPause,
  onResume,
  onStop,
  onSpeedChange,
  onClearWaypoints,
  disabled = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentWaypointIndex = isActive && waypoints.length > 0 
    ? Math.floor(progress * waypoints.length) 
    : 0;

  // Handle speed change
  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value);
    onSpeedChange(newSpeed);
  };
  
  // Draw map and drone position
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Convert lat/lng coordinates to canvas coordinates
    const convertToCanvasCoords = (coords: Coordinate) => {
      // This is a simple mapping - you may need a more sophisticated approach
      // depending on your coordinate ranges
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // You'll need to adjust these min/max values based on your data
      const minLat = Math.min(...waypoints.map(wp => wp.lat), currentPosition?.lat || Infinity) - 0.001;
      const maxLat = Math.max(...waypoints.map(wp => wp.lat), currentPosition?.lat || -Infinity) + 0.001;
      const minLng = Math.min(...waypoints.map(wp => wp.lng), currentPosition?.lng || Infinity) - 0.001;
      const maxLng = Math.max(...waypoints.map(wp => wp.lng), currentPosition?.lng || -Infinity) + 0.001;
      
      const latRange = maxLat - minLat;
      const lngRange = maxLng - minLng;
      
      // Avoid division by zero
      if (latRange === 0 || lngRange === 0) {
        return { x: canvasWidth / 2, y: canvasHeight / 2 };
      }
      
      // Padding to keep points away from the edges
      const padding = 20;
      
      const x = ((coords.lng - minLng) / lngRange) * (canvasWidth - 2 * padding) + padding;
      // Y is inverted because canvas coordinates increase downward
      const y = (1 - (coords.lat - minLat) / latRange) * (canvasHeight - 2 * padding) + padding;
      
      return { x, y };
    };
    
    // Draw waypoints and path
    if (waypoints.length > 0) {
      // Convert all waypoints to canvas coordinates
      const canvasWaypoints = waypoints.map(convertToCanvasCoords);
      
      // Draw lines between waypoints
      ctx.beginPath();
      ctx.moveTo(canvasWaypoints[0].x, canvasWaypoints[0].y);
      for (let i = 1; i < canvasWaypoints.length; i++) {
        ctx.lineTo(canvasWaypoints[i].x, canvasWaypoints[i].y);
      }
      ctx.strokeStyle = '#3B82F6'; // Blue
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw waypoints as circles
      canvasWaypoints.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        
        // Highlight current waypoint
        if (index === currentWaypointIndex) {
          ctx.fillStyle = '#10B981'; // Green
        } else if (index < currentWaypointIndex) {
          ctx.fillStyle = '#6B7280'; // Grey (visited)
        } else {
          ctx.fillStyle = '#3B82F6'; // Blue (not visited)
        }
        ctx.fill();
        
        // Add waypoint number
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((index + 1).toString(), point.x, point.y);
      });
    }
    
    // Draw current drone position
    if (currentPosition) {
      const dronePos = convertToCanvasCoords(currentPosition);
      
      ctx.beginPath();
      ctx.arc(dronePos.x, dronePos.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#EF4444'; // Red
      ctx.fill();
      
      // Draw drone icon (simple triangle)
      ctx.beginPath();
      ctx.moveTo(dronePos.x, dronePos.y - 10);
      ctx.lineTo(dronePos.x - 5, dronePos.y + 5);
      ctx.lineTo(dronePos.x + 5, dronePos.y + 5);
      ctx.closePath();
      ctx.fillStyle = '#EF4444'; // Red
      ctx.fill();
    }
  }, [waypoints, currentPosition, currentWaypointIndex]);
  
  return (
    <div className="drone-simulator p-4 border rounded bg-gray-50">
      <h3 className="text-lg font-medium mb-4">Drone Simulator</h3>
      
      <div className="relative mb-4">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="border border-gray-300 w-full h-auto bg-gray-100"
        />
        
        <div className="absolute top-2 left-2 bg-white bg-opacity-80 p-2 rounded text-sm">
          {!isActive ? (
            <span>Use the map to add waypoints</span>
          ) : (
            <span>Simulation in progress</span>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {!isActive ? (
          <button
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            onClick={onStart}
            disabled={disabled || waypoints.length < 2}
          >
            Start Simulation
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={onResume}
              >
                Resume
              </button>
            ) : (
              <button
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                onClick={onPause}
              >
                Pause
              </button>
            )}
            
            <button
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              onClick={onStop}
            >
              Stop
            </button>
          </>
        )}
        
        <button
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          onClick={onClearWaypoints}
          disabled={isActive || waypoints.length === 0}
        >
          Clear Waypoints
        </button>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Simulation Speed: {speed.toFixed(1)}x
        </label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={speed}
          onChange={handleSpeedChange}
          disabled={disabled || !isActive}
          className="w-full"
        />
      </div>
      
      {isActive && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Progress
          </label>
          <div className="w-full bg-gray-200 rounded h-4">
            <div
              className="bg-blue-500 h-4 rounded"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            ></div>
          </div>
          <div className="text-right text-xs text-gray-500 mt-1">
            {(progress * 100).toFixed(1)}%
          </div>
        </div>
      )}
      
      <div className="text-sm text-gray-600">
        {isActive ? (
          isPaused ? 
            <span className="text-yellow-600">⏸️ Simulation Paused</span> : 
            <span className="text-green-600">▶️ Simulation Running</span>
        ) : (
          <span className="text-gray-600">⏹️ Simulation Stopped</span>
        )}
      </div>
      
      <div className="mt-4">
        <h3 className="text-lg font-medium mb-2">Waypoints</h3>
        
        {waypoints.length === 0 ? (
          <p className="text-gray-500 text-sm">No waypoints added yet.</p>
        ) : (
          <div className="max-h-60 overflow-y-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-sm">#</th>
                  <th className="text-left text-sm">Latitude</th>
                  <th className="text-left text-sm">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {waypoints.map((point, index) => (
                  <tr 
                    key={index}
                    className={index === currentWaypointIndex && isActive ? 'bg-green-100' : ''}
                  >
                    <td className="text-sm py-1">{index + 1}</td>
                    <td className="text-sm py-1">{point.lat.toFixed(6)}</td>
                    <td className="text-sm py-1">{point.lng.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DroneSimulator;