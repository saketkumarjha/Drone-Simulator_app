// server.ts - Main entry point for the drone simulator backend

import express, { Express, NextFunction, Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import bodyParser from 'body-parser';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';

// Type definitions to make our code type-safe
interface Coordinate {
  lat: number;
  lng: number;
}

interface SimulationState {
  waypoints: Coordinate[];
  currentWaypointIndex: number;
  nextWaypointIndex: number;
  progress: number;
  speed: number;
  isPaused: boolean;
  startTime: number;
  currentPosition: Coordinate;
  totalDistance?: number;
  isComplete?: boolean;
}

interface ActiveSimulation {
  state: SimulationState;
  interval: NodeJS.Timeout;
}

interface WebSocketWithId extends WebSocket {
  id?: string;
}

interface WebSocketMessage {
  type: string;
  waypoints?: Coordinate[];
  speed?: number;
  
}

interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

// Initialize Express app
const app: Express = express();
const server = http.createServer(app);

// Set up WebSocket server for real-time updates
const wss = new WebSocketServer({port: 8085});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
}));
app.use(express.static('public'));

// Store active simulations
const activeSimulations = new Map<string, ActiveSimulation>();

// WebSocket connection handling
wss.on('connection', (ws: WebSocketWithId) => {
  console.log('Client connected');
  
  // Assign a unique ID to each connection
  ws.id = Date.now().toString();
  console.log(`Assigned ID: ${ws.id}`);
  ws.on('message', (message: Buffer) => {
    try {
      // Parse incoming message to JSON
      const data = JSON.parse(message.toString()) as WebSocketMessage;
      
      // Handle different message types
      switch (data.type) {
        case 'START_SIMULATION':
          handleStartSimulation(ws, data);
          break;
        case 'PAUSE_SIMULATION':
          if (ws.id) handlePauseSimulation(ws.id);
          break;
        case 'RESUME_SIMULATION':
          if (ws.id) handleResumeSimulation(ws.id);
          break;
        case 'STOP_SIMULATION':
          if (ws.id) handleStopSimulation(ws.id);
          break;
        case 'UPDATE_SPEED':
          if (ws.id && typeof data.speed === 'number') handleUpdateSpeed(ws.id, data.speed);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    // Clean up any active simulations for this client
    if (ws.id && activeSimulations.has(ws.id)) {
      clearInterval(activeSimulations.get(ws.id)!.interval);
      activeSimulations.delete(ws.id);
    }
  });
});

// Simulation Handlers

/**
 * Starts a new drone simulation with the given waypoints and speed
 */
function handleStartSimulation(ws: WebSocketWithId, data: WebSocketMessage): void {
  if (!ws.id) return;
  
  const waypoints = data.waypoints as Coordinate[] | undefined;
  const speed = data.speed as number | undefined;
  
  if (!waypoints || waypoints.length < 2) {
    sendError(ws, 'At least two waypoints are required');
    return;
  }
  
  // Stop any existing simulation for this client
  if (activeSimulations.has(ws.id)) {
    clearInterval(activeSimulations.get(ws.id)!.interval);
  }
  
  // Initialize simulation state
  const simulationState: SimulationState = {
    waypoints,
    currentWaypointIndex: 0,
    nextWaypointIndex: 1,
    progress: 0,
    speed: speed || 1, // Default speed multiplier
    isPaused: false,
    startTime: Date.now(),
    currentPosition: { ...waypoints[0] }
  };
  
  // Calculate total distance for progress tracking
  simulationState.totalDistance = calculateTotalDistance(waypoints);
  
  // Start the simulation loop - updates 10 times per second
  const interval = setInterval(() => {
    if (simulationState.isPaused) return;
    
    // Update drone position
    updateDronePosition(simulationState);
    
    // Send updated position to client
    ws.send(JSON.stringify({
      type: 'POSITION_UPDATE',
      position: simulationState.currentPosition,
      progress: simulationState.progress,
      currentWaypoint: simulationState.currentWaypointIndex,
      isComplete: simulationState.isComplete || false
    }));
    
    // Check if simulation is complete
    if (simulationState.isComplete) {
      clearInterval(interval);
      if (ws.id) activeSimulations.delete(ws.id);
    }
  }, 100); // Update 10 times per second
  
  // Store the simulation
  activeSimulations.set(ws.id, {
    state: simulationState,
    interval
  });
  
  // Send initial confirmation
  ws.send(JSON.stringify({ 
    type: 'SIMULATION_STARTED',
    initialPosition: waypoints[0]
  }));
}

/**
 * Pauses an active simulation
 */
function handlePauseSimulation(clientId: string): void {
  if (activeSimulations.has(clientId)) {
    activeSimulations.get(clientId)!.state.isPaused = true;
  }
}

/**
 * Resumes a paused simulation
 */
function handleResumeSimulation(clientId: string): void {
  if (activeSimulations.has(clientId)) {
    activeSimulations.get(clientId)!.state.isPaused = false;
  }
}

/**
 * Stops and removes a simulation
 */
function handleStopSimulation(clientId: string): void {
  if (activeSimulations.has(clientId)) {
    clearInterval(activeSimulations.get(clientId)!.interval);
    activeSimulations.delete(clientId);
  }
}

/**
 * Updates the speed of an active simulation
 */
function handleUpdateSpeed(clientId: string, speed: number): void {
  if (activeSimulations.has(clientId)) {
    activeSimulations.get(clientId)!.state.speed = speed;
  }
}

/**
 * Calculates the new position of the drone based on current state
 */
function updateDronePosition(state: SimulationState): void {
  const { currentWaypointIndex, nextWaypointIndex, waypoints, speed } = state;
  
  // If we've reached the end of the waypoints
  if (nextWaypointIndex >= waypoints.length) {
    state.isComplete = true;
    return;
  }
  
  const current = waypoints[currentWaypointIndex];
  const next = waypoints[nextWaypointIndex];
  
  // Calculate distance between waypoints
  const segmentDistance = calculateDistance(current, next);
  
  // Calculate how much to move in this step
  // Speed is in degrees per second, and we update 10 times per second
  const step = (speed * 0.0001) / 10;
  state.progress += step;
  
  // Calculate interpolated position
  const ratio = Math.min(state.progress / segmentDistance, 1);
  
  state.currentPosition = {
    lat: current.lat + (next.lat - current.lat) * ratio,
    lng: current.lng + (next.lng - current.lng) * ratio
  };
  
  // If we've reached the next waypoint, advance to the next segment
  if (ratio >= 1) {
    state.currentWaypointIndex++;
    state.nextWaypointIndex++;
    state.progress = 0;
  }
}

// Utility Functions

/**
 * Calculates distance between two coordinates
 * Simple Euclidean distance for demonstration
 * In a real app, you'd want to use the Haversine formula for geographic coordinates
 */
function calculateDistance(point1: Coordinate, point2: Coordinate): number {
  const latDiff = point2.lat - point1.lat;
  const lngDiff = point2.lng - point1.lng;
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}

/**
 * Calculates the total distance of a route through all waypoints
 */
function calculateTotalDistance(waypoints: Coordinate[]): number {
  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistance += calculateDistance(waypoints[i], waypoints[i+1]);
  }
  return totalDistance;
}

/**
 * Sends an error message to a client
 */
function sendError(ws: WebSocket, message: string): void {
  ws.send(JSON.stringify({
    type: 'ERROR',
    message
  }));
}

// API Routes

/**
 * Handles file uploads containing coordinate data
 */
//@ts-ignore
app.post('/api/upload-coordinates', async (req: Request, res: Response) => {
    try {
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const file = req.files.file as fileUpload.UploadedFile;
      const filePath = path.join(__dirname, 'uploads', file.name);
      
      // Convert file.mv to a Promise to use with async/await
      await new Promise<void>((resolve, reject) => {
        file.mv(filePath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Read and parse the file
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const coordinates = parseCoordinateFile(fileContent, file.name);
      
      // Clean up - remove the file after processing
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
        // Continue even if cleanup fails
      }
      
      // Return parsed coordinates
      return res.json({ 
        success: true, 
        coordinates,
        message: `Successfully parsed ${coordinates.length} waypoints` 
      });
    } catch (error) {
      // If it's a file.mv error
      if (error instanceof Error) {
        return res.status(500).json({ error: `Error saving file: ${error.message}` });
      }
      
      // For other errors
      return res.status(500).json({ error: 'Server error processing file' });
    }
  });

/**
 * Geocoding API endpoint
 */
//@ts-ignore
app.get('/api/geocode', async (req: Request, res: Response) => {
  const query = req.query.query as string | undefined;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  try {
    // Here you would typically integrate with a third-party geocoding service
    // like Google Maps, Mapbox, or OpenStreetMap Nominatim
    // For this example, we'll return mock data
    const results = mockGeocodeSearch(query);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: `Error searching locations ${error}` });
  }
});

/**
 * Mock geocoding function - in production, replace with actual API call
 */
function mockGeocodeSearch(query: string): GeocodeResult[] {
  // Return some sample results based on the query
  if (query.toLowerCase().includes('new york')) {
    return [
      { name: 'New York, NY, USA', lat: 40.7128, lng: -74.0060 },
      { name: 'New York Mills, MN, USA', lat: 46.5188, lng: -95.3767 }
    ];
  } else if (query.toLowerCase().includes('london')) {
    return [
      { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
      { name: 'London, ON, Canada', lat: 42.9849, lng: -81.2453 }
    ];
  } else {
    return [
      { name: 'Paris, France', lat: 48.8566, lng: 2.3522 },
      { name: 'Berlin, Germany', lat: 52.5200, lng: 13.4050 },
      { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 }
    ];
  }
}

// File parsing functions

/**
 * Parses coordinate files based on their extension
 */
function parseCoordinateFile(content: string, filename: string): Coordinate[] {
  const extension = path.extname(filename).toLowerCase();
  
  // Handle different file formats
  if (extension === '.json') {
    return parseJsonCoordinates(content);
  } else if (extension === '.csv') {
    return parseCsvCoordinates(content);
  } else if (extension === '.txt') {
    return parseTxtCoordinates(content);
  } else {
    throw new Error('Unsupported file format. Please upload JSON, CSV, or TXT files.');
  }
}

/**
 * Parses JSON coordinate files
 */
function parseJsonCoordinates(content: string): Coordinate[] {
  try {
    const data = JSON.parse(content);
    
    // Handle array format
    if (Array.isArray(data)) {
      return data.map(point => {
        if (typeof point.lat !== 'number' || typeof point.lng !== 'number') {
          throw new Error('Invalid coordinate format. Expected {lat, lng} objects.');
        }
        return { lat: point.lat, lng: point.lng };
      });
    } 
    // Handle GeoJSON format
    else if (data.type === 'FeatureCollection') {
      return data.features.map((feature:any) => {
        if (!feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
          throw new Error('Invalid GeoJSON format. Expected coordinates array in geometry.');
        }
        const [lng, lat] = feature.geometry.coordinates;
        return { lat, lng };
      });
    } else {
      throw new Error('Invalid JSON format. Expected array of coordinates or GeoJSON.');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`JSON parsing error: ${errorMessage}`);
  }
}

/**
 * Parses CSV coordinate files
 */
function parseCsvCoordinates(content: string): Coordinate[] {
  try {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header and one data row.');
    }
    
    const headers = lines[0].toLowerCase().split(',');
    
    // Find lat/lng column indices
    const latIndex = headers.findIndex(h => h.includes('lat'));
    const lngIndex = headers.findIndex(h => h.includes('lon') || h.includes('lng'));
    
    if (latIndex === -1 || lngIndex === -1) {
      throw new Error('Could not find latitude/longitude columns in CSV.');
    }
    
    return lines.slice(1).map(line => {
      const values = line.split(',');
      if (values.length <= Math.max(latIndex, lngIndex)) {
        throw new Error('CSV row has fewer columns than expected.');
      }
      
      const lat = parseFloat(values[latIndex]);
      const lng = parseFloat(values[lngIndex]);
      
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid coordinate values in CSV.');
      }
      
      return { lat, lng };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`CSV parsing error: ${errorMessage}`);
  }
}

/**
 * Parses TXT coordinate files
 */
function parseTxtCoordinates(content: string): Coordinate[] {
  try {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('Text file contains no data.');
    }
    
    return lines.map(line => {
      // Try different formats
      // Format: "lat,lng" or "lat lng"
      const parts = line.includes(',') ? line.split(',') : line.split(/\s+/);
      
      if (parts.length < 2) {
        throw new Error('Invalid coordinate format in text file.');
      }
      
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid coordinate values in text file.');
      }
      
      return { lat, lng };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Text file parsing error: ${errorMessage}`);
  }
}

// Create uploads directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Error handling middleware
app.use((error: unknown, req: Request, res: Response, next:NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
  next();
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});

export default app;