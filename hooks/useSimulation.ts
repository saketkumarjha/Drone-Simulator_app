import { useState, useEffect, useCallback } from 'react';
import { Coordinate, SimulationOptions, simulationSocket } from '../lib/api';

// Define the base WebSocketMessage type and specific message subtypes
interface WebSocketMessage {
  type: string;
}

interface PositionUpdateMessage extends WebSocketMessage {
  type: 'POSITION_UPDATE';
  position: Coordinate;
  progress: number;
  currentWaypoint: number;
  isComplete: boolean;
}

interface SimulationStartedMessage extends WebSocketMessage {
  type: 'SIMULATION_STARTED';
  initialPosition: Coordinate;
}

interface ErrorMessage extends WebSocketMessage {
  type: 'ERROR';
  message: string;
}

// Type guard functions to check message types
function isPositionUpdate(message: WebSocketMessage): message is PositionUpdateMessage {
  return message.type === 'POSITION_UPDATE';
}

function isSimulationStarted(message: WebSocketMessage): message is SimulationStartedMessage {
  return message.type === 'SIMULATION_STARTED';
}

function isError(message: WebSocketMessage): message is ErrorMessage {
  return message.type === 'ERROR';
}

interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  currentPosition: Coordinate | null;
  progress: number;
  currentWaypoint: number;
  speed: number;
}

export const useSimulation = (initialWaypoints: Coordinate[] = []) => {
  const [waypoints, setWaypoints] = useState<Coordinate[]>(initialWaypoints);
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: false,
    isPaused: false,
    currentPosition: null,
    progress: 0,
    currentWaypoint: 0,
    speed: 1
  });
  
  // Initialize WebSocket event listeners
  useEffect(() => {
    // Listen for position updates
    const removePositionListener = simulationSocket.on('POSITION_UPDATE', (data: WebSocketMessage) => {
      if (isPositionUpdate(data)) {
        setSimulationState(prev => ({
          ...prev,
          currentPosition: data.position,
          progress: data.progress,
          currentWaypoint: data.currentWaypoint,
          isRunning: !data.isComplete,
          isPaused: false
        }));
      }
    });
    
    // Listen for simulation started event
    const removeStartListener = simulationSocket.on('SIMULATION_STARTED', (data: WebSocketMessage) => {
      if (isSimulationStarted(data)) {
        setSimulationState(prev => ({
          ...prev,
          isRunning: true,
          isPaused: false,
          currentPosition: data.initialPosition,
          progress: 0,
          currentWaypoint: 0
        }));
      }
    });
    
    // Listen for errors
    const removeErrorListener = simulationSocket.on('ERROR', (data: WebSocketMessage) => {
      if (isError(data)) {
        console.error('Simulation error:', data.message);
        // You might want to handle this in the UI
      }
    });
    
    // Cleanup listeners on unmount
    return () => {
      removePositionListener();
      removeStartListener();
      removeErrorListener();
      
      // Stop any running simulation when component unmounts
      if (simulationState.isRunning) {
        simulationSocket.stopSimulation();
      }
    };
  }, [simulationState.isRunning]); // Added missing dependency
  
  // Start simulation
  const startSimulation = useCallback((options?: Partial<SimulationOptions>) => {
    if (waypoints.length < 2) {
      console.error('At least two waypoints are required to start a simulation');
      return;
    }
    
    simulationSocket.startSimulation({
      waypoints,
      speed: options?.speed || simulationState.speed
    });
  }, [waypoints, simulationState.speed]);
  
  // Pause simulation
  const pauseSimulation = useCallback(() => {
    simulationSocket.pauseSimulation();
    setSimulationState(prev => ({ ...prev, isPaused: true }));
  }, []);
  
  // Resume simulation
  const resumeSimulation = useCallback(() => {
    simulationSocket.resumeSimulation();
    setSimulationState(prev => ({ ...prev, isPaused: false }));
  }, []);
  
  // Stop simulation
  const stopSimulation = useCallback(() => {
    simulationSocket.stopSimulation();
    setSimulationState({
      isRunning: false,
      isPaused: false,
      currentPosition: null,
      progress: 0,
      currentWaypoint: 0,
      speed: simulationState.speed
    });
  }, [simulationState.speed]);
  
  // Update simulation speed
  const updateSpeed = useCallback((speed: number) => {
    simulationSocket.updateSpeed(speed);
    setSimulationState(prev => ({ ...prev, speed }));
  }, []);
  
  // Add a waypoint
  const addWaypoint = useCallback((waypoint: Coordinate) => {
    setWaypoints(prev => [...prev, waypoint]);
  }, []);
  
  // Remove a waypoint
  const removeWaypoint = useCallback((index: number) => {
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  // Update a waypoint
  const updateWaypoint = useCallback((index: number, waypoint: Coordinate) => {
    setWaypoints(prev => prev.map((wp, i) => i === index ? waypoint : wp));
  }, []);
  
  // Clear all waypoints
  const clearWaypoints = useCallback(() => {
    setWaypoints([]);
  }, []);
  
  // Set waypoints (replace all)
  const setAllWaypoints = useCallback((newWaypoints: Coordinate[]) => {
    setWaypoints(newWaypoints);
  }, []);
  
  return {
    waypoints,
    simulationState,
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
    isActive: simulationState.isRunning,
    isPaused: simulationState.isPaused,
    currentPosition: simulationState.currentPosition,
    progress: simulationState.progress,
    currentWaypoint: simulationState.currentWaypoint,
    speed: simulationState.speed
  };
};