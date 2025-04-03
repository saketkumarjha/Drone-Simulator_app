"use strict";
// server.ts - Main entry point for the drone simulator backend
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Initialize Express app
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Set up WebSocket server for real-time updates
const wss = new ws_1.WebSocketServer({ port: 8085 });
// Middleware
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use((0, express_fileupload_1.default)({
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
}));
app.use(express_1.default.static('public'));
// Store active simulations
const activeSimulations = new Map();
// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('Client connected');
    // Assign a unique ID to each connection
    ws.id = Date.now().toString();
    console.log(`Assigned ID: ${ws.id}`);
    ws.on('message', (message) => {
        try {
            // Parse incoming message to JSON
            const data = JSON.parse(message.toString());
            // Handle different message types
            switch (data.type) {
                case 'START_SIMULATION':
                    handleStartSimulation(ws, data);
                    break;
                case 'PAUSE_SIMULATION':
                    if (ws.id)
                        handlePauseSimulation(ws.id);
                    break;
                case 'RESUME_SIMULATION':
                    if (ws.id)
                        handleResumeSimulation(ws.id);
                    break;
                case 'STOP_SIMULATION':
                    if (ws.id)
                        handleStopSimulation(ws.id);
                    break;
                case 'UPDATE_SPEED':
                    if (ws.id && typeof data.speed === 'number')
                        handleUpdateSpeed(ws.id, data.speed);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        }
        catch (error) {
            console.error('Error processing message:', error);
        }
    });
    ws.on('close', () => {
        console.log('Client disconnected');
        // Clean up any active simulations for this client
        if (ws.id && activeSimulations.has(ws.id)) {
            clearInterval(activeSimulations.get(ws.id).interval);
            activeSimulations.delete(ws.id);
        }
    });
});
// Simulation Handlers
/**
 * Starts a new drone simulation with the given waypoints and speed
 */
function handleStartSimulation(ws, data) {
    if (!ws.id)
        return;
    const waypoints = data.waypoints;
    const speed = data.speed;
    if (!waypoints || waypoints.length < 2) {
        sendError(ws, 'At least two waypoints are required');
        return;
    }
    // Stop any existing simulation for this client
    if (activeSimulations.has(ws.id)) {
        clearInterval(activeSimulations.get(ws.id).interval);
    }
    // Initialize simulation state
    const simulationState = {
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
        if (simulationState.isPaused)
            return;
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
            if (ws.id)
                activeSimulations.delete(ws.id);
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
function handlePauseSimulation(clientId) {
    if (activeSimulations.has(clientId)) {
        activeSimulations.get(clientId).state.isPaused = true;
    }
}
/**
 * Resumes a paused simulation
 */
function handleResumeSimulation(clientId) {
    if (activeSimulations.has(clientId)) {
        activeSimulations.get(clientId).state.isPaused = false;
    }
}
/**
 * Stops and removes a simulation
 */
function handleStopSimulation(clientId) {
    if (activeSimulations.has(clientId)) {
        clearInterval(activeSimulations.get(clientId).interval);
        activeSimulations.delete(clientId);
    }
}
/**
 * Updates the speed of an active simulation
 */
function handleUpdateSpeed(clientId, speed) {
    if (activeSimulations.has(clientId)) {
        activeSimulations.get(clientId).state.speed = speed;
    }
}
/**
 * Calculates the new position of the drone based on current state
 */
function updateDronePosition(state) {
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
function calculateDistance(point1, point2) {
    const latDiff = point2.lat - point1.lat;
    const lngDiff = point2.lng - point1.lng;
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}
/**
 * Calculates the total distance of a route through all waypoints
 */
function calculateTotalDistance(waypoints) {
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
        totalDistance += calculateDistance(waypoints[i], waypoints[i + 1]);
    }
    return totalDistance;
}
/**
 * Sends an error message to a client
 */
function sendError(ws, message) {
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
app.post('/api/upload-coordinates', async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const file = req.files.file;
        const filePath = path_1.default.join(__dirname, 'uploads', file.name);
        // Convert file.mv to a Promise to use with async/await
        await new Promise((resolve, reject) => {
            file.mv(filePath, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        // Read and parse the file
        const fileContent = fs_1.default.readFileSync(filePath, 'utf8');
        const coordinates = parseCoordinateFile(fileContent, file.name);
        // Clean up - remove the file after processing
        try {
            fs_1.default.unlinkSync(filePath);
        }
        catch (cleanupError) {
            console.error('Error cleaning up file:', cleanupError);
            // Continue even if cleanup fails
        }
        // Return parsed coordinates
        return res.json({
            success: true,
            coordinates,
            message: `Successfully parsed ${coordinates.length} waypoints`
        });
    }
    catch (error) {
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
app.get('/api/geocode', async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    try {
        // Here you would typically integrate with a third-party geocoding service
        // like Google Maps, Mapbox, or OpenStreetMap Nominatim
        // For this example, we'll return mock data
        const results = mockGeocodeSearch(query);
        res.json({ results });
    }
    catch (error) {
        res.status(500).json({ error: `Error searching locations ${error}` });
    }
});
/**
 * Mock geocoding function - in production, replace with actual API call
 */
function mockGeocodeSearch(query) {
    // Return some sample results based on the query
    if (query.toLowerCase().includes('new york')) {
        return [
            { name: 'New York, NY, USA', lat: 40.7128, lng: -74.0060 },
            { name: 'New York Mills, MN, USA', lat: 46.5188, lng: -95.3767 }
        ];
    }
    else if (query.toLowerCase().includes('london')) {
        return [
            { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
            { name: 'London, ON, Canada', lat: 42.9849, lng: -81.2453 }
        ];
    }
    else {
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
function parseCoordinateFile(content, filename) {
    const extension = path_1.default.extname(filename).toLowerCase();
    // Handle different file formats
    if (extension === '.json') {
        return parseJsonCoordinates(content);
    }
    else if (extension === '.csv') {
        return parseCsvCoordinates(content);
    }
    else if (extension === '.txt') {
        return parseTxtCoordinates(content);
    }
    else {
        throw new Error('Unsupported file format. Please upload JSON, CSV, or TXT files.');
    }
}
/**
 * Parses JSON coordinate files
 */
function parseJsonCoordinates(content) {
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
            return data.features.map((feature) => {
                if (!feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
                    throw new Error('Invalid GeoJSON format. Expected coordinates array in geometry.');
                }
                const [lng, lat] = feature.geometry.coordinates;
                return { lat, lng };
            });
        }
        else {
            throw new Error('Invalid JSON format. Expected array of coordinates or GeoJSON.');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`JSON parsing error: ${errorMessage}`);
    }
}
/**
 * Parses CSV coordinate files
 */
function parseCsvCoordinates(content) {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`CSV parsing error: ${errorMessage}`);
    }
}
/**
 * Parses TXT coordinate files
 */
function parseTxtCoordinates(content) {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Text file parsing error: ${errorMessage}`);
    }
}
// Create uploads directory if it doesn't exist
if (!fs_1.default.existsSync(path_1.default.join(__dirname, 'uploads'))) {
    fs_1.default.mkdirSync(path_1.default.join(__dirname, 'uploads'));
}
// Error handling middleware
app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
    next();
});
// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
});
exports.default = app;
