'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Coordinate } from '@/lib/api';

// Import LeafletMap component with no SSR
const LeafletMap = dynamic(
  () => import('../map/LeafletMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] border rounded shadow-md flex items-center justify-center bg-gray-100">
        <span className="text-gray-600">Loading map...</span>
      </div>
    )
  }
);

interface MapWrapperProps {
  waypoints: Coordinate[];
  onMapClick?: (position: { lat: number; lng: number }) => void;
  centerOn?: Coordinate;
  disabled?: boolean;
  simulationMarker?: Coordinate | null;
}

const MapWrapper: React.FC<MapWrapperProps> = (props) => {
  return (
    <Suspense fallback={
      <div className="w-full h-[500px] border rounded shadow-md flex items-center justify-center bg-gray-100">
        <span className="text-gray-600">Loading map...</span>
      </div>
    }>
      <LeafletMap {...props} />
    </Suspense>
  );
};

export default MapWrapper;