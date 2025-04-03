import React, { useState } from 'react';
import { uploadCoordinateFile } from '@/lib/api';

interface Coordinate {
  lat: number;
  lng: number;
}

interface FileImportProps {
  onImportSuccess: (coordinates: Coordinate[]) => void;
  disabled?: boolean;
}

const FileImport: React.FC<FileImportProps> = ({
  onImportSuccess,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const coordinates = await uploadCoordinateFile(file);
      onImportSuccess(coordinates);
      setSuccess(`Successfully imported ${coordinates.length} waypoints`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import file';
      setError(errorMessage);
      console.error('Error importing file:', err);
    } finally {
      setIsLoading(false);
      // Reset the file input
      e.target.value = '';
    }
  };
  
  return (
    <div className="file-import p-4 border rounded">
      <h3 className="text-lg font-medium mb-2">Import Coordinates</h3>
      
      <p className="mb-4">
        Upload a file containing waypoint coordinates.
        Supported formats: CSV, JSON, TXT
      </p>
      
      <div className="mb-4">
        <input
          type="file"
          accept=".csv,.json,.txt"
          onChange={handleFileUpload}
          disabled={disabled || isLoading}
          className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
        />
      </div>
      
      {isLoading && (
        <div className="text-gray-600">Loading...</div>
      )}
      
      {error && (
        <div className="text-red-500 mt-2">{error}</div>
      )}
      
      {success && (
        <div className="text-green-500 mt-2">{success}</div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        <h4 className="font-medium">File Format Requirements:</h4>
        <ul className="list-disc pl-5 mt-1">
          <li>CSV: Include &apos;lat/latitude&apos; and &apos;lng/longitude&apos; columns</li>
          <li>JSON: Array of objects with &apos;lat&apos; and &apos;lng&apos; properties</li>
          <li>TXT: One coordinate pair per line (lat,lng or lat lng)</li>
        </ul>
      </div>
    </div>
  );
};

export default FileImport;