// src/components/data/CoordinateTable.tsx
import React, { useState } from 'react';
import { Coordinate } from '../../lib/api';

interface CoordinateTableProps {
  coordinates: Coordinate[];
  onAddCoordinate: (coordinate: Coordinate) => void;
  onUpdateCoordinate: (index: number, coordinate: Coordinate) => void;
  onRemoveCoordinate: (index: number) => void;
  onClearCoordinates: () => void;
  disabled?: boolean;
}

const CoordinateTable: React.FC<CoordinateTableProps> = ({
  coordinates,
  onAddCoordinate,
  onUpdateCoordinate,
  onRemoveCoordinate,
  onClearCoordinates,
  disabled = false
}) => {
  const [newLat, setNewLat] = useState<string>('');
  const [newLng, setNewLng] = useState<string>('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  
  const handleAddCoordinate = () => {
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid latitude and longitude values');
      return;
    }
    
    onAddCoordinate({ lat, lng });
    setNewLat('');
    setNewLng('');
  };
  
  const handleUpdateCoordinate = (index: number) => {
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid latitude and longitude values');
      return;
    }
    
    onUpdateCoordinate(index, { lat, lng });
    setNewLat('');
    setNewLng('');
    setEditIndex(null);
  };
  
  const startEditing = (index: number) => {
    const coordinate = coordinates[index];
    setNewLat(coordinate.lat.toString());
    setNewLng(coordinate.lng.toString());
    setEditIndex(index);
  };
  
  const cancelEditing = () => {
    setNewLat('');
    setNewLng('');
    setEditIndex(null);
  };
  
  return (
    <div className="coordinate-table">
      <h3 className='text-black'>Waypoints</h3>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2">#</th>
            <th className="border p-2">Latitude</th>
            <th className="border p-2">Longitude</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {coordinates.map((coordinate, index) => (
            <tr key={index}>
              <td className="border p-2">{index + 1}</td>
              <td className="border p-2">{coordinate.lat.toFixed(6)}</td>
              <td className="border p-2">{coordinate.lng.toFixed(6)}</td>
              <td className="border p-2">
                <button
                  className="mr-2 px-2 py-1 bg-blue-500 text-white rounded"
                  onClick={() => startEditing(index)}
                  disabled={disabled || editIndex !== null}
                >
                  Edit
                </button>
                <button
                  className="px-2 py-1 bg-red-500 text-white rounded"
                  onClick={() => onRemoveCoordinate(index)}
                  disabled={disabled}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {coordinates.length === 0 && (
            <tr>
              <td colSpan={4} className="border p-2 text-center">
                No waypoints added yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      <div className="mt-4">
        <h4>{editIndex !== null ? 'Edit Waypoint' : 'Add New Waypoint'}</h4>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            placeholder="Latitude"
            className="p-2 border rounded"
            value={newLat}
            onChange={(e) => setNewLat(e.target.value)}
            disabled={disabled}
          />
          <input
            type="text"
            placeholder="Longitude"
            className="p-2 border rounded"
            value={newLng}
            onChange={(e) => setNewLng(e.target.value)}
            disabled={disabled}
          />
          {editIndex !== null ? (
            <>
              <button
                className="px-4 py-2 bg-green-500 text-white rounded"
                onClick={() => handleUpdateCoordinate(editIndex)}
                disabled={disabled}
              >
                Update
              </button>
              <button
                className="px-4 py-2 bg-gray-500 text-white rounded"
                onClick={cancelEditing}
                disabled={disabled}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="px-4 py-2 bg-green-500 text-white rounded"
              onClick={handleAddCoordinate}
              disabled={disabled}
            >
              Add
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-4">
        <button
          className="px-4 py-2 bg-red-500 text-white rounded"
          onClick={onClearCoordinates}
          disabled={disabled || coordinates.length === 0}
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default CoordinateTable;