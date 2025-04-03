// src/lib/api.ts
import axios from "axios";

const API_BASE_URL = "http://localhost:3001/api";
const WS_URL = "ws://localhost:8085";

// Define types
export interface Coordinate {
  lat: number;
  lng: number;
  timestamp?: number;
}

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

export interface SimulationOptions {
  waypoints: Coordinate[];
  speed: number;
}

// Define message types
export interface SimulationMessage {
  type: string;
  [key: string]: unknown;
}

export interface PositionUpdateMessage {
  type: "POSITION_UPDATE";
  position: Coordinate;
  progress: number;
  currentWaypoint: number;
  isComplete: boolean;
}

export interface SimulationStartedMessage {
  type: "SIMULATION_STARTED";
  initialPosition: Coordinate;
}

export interface ErrorMessage {
  type: "ERROR";
  message: string;
}

// Union type of all possible message types
export type WebSocketMessage =
  | PositionUpdateMessage
  | SimulationStartedMessage
  | ErrorMessage
  | { type: string; [key: string]: unknown };

// API functions
export const uploadCoordinateFile = async (
  file: File
): Promise<Coordinate[]> => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await axios.post<{
      coordinates: Coordinate[];
      success: boolean;
      message: string;
    }>(`${API_BASE_URL}/upload-coordinates`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data.coordinates;
  } catch (error) {
    console.error("Error uploading coordinates:", error);
    throw error;
  }
};

export const searchLocations = async (
  query: string
): Promise<GeocodeResult[]> => {
  try {
    const response = await axios.get<{ results: GeocodeResult[] }>(
      `${API_BASE_URL}/geocode`,
      {
        params: { query },
      }
    );

    return response.data.results;
  } catch (error) {
    console.error("Error searching locations:", error);
    throw error;
  }
};

// WebSocket class for simulation
export class SimulationSocket {
  private socket: WebSocket | null = null;
  private isConnected = false;
  private messageQueue: SimulationMessage[] = [];
  private eventListeners: Record<
    string,
    Array<(data: WebSocketMessage) => void>
  > = {};
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  constructor() {
    this.connect();
  }

  private connect(): void {
    // Use the correct WebSocket URL
    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log("WebSocket connected to", WS_URL);

      // Send any queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) this.send(message);
      }
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        this.handleMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.socket.onclose = (event) => {
      this.isConnected = false;
      console.log(`WebSocket disconnected with code ${event.code}, reason: ${event.reason}`);

      // Attempt to reconnect after a delay, with a maximum number of attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log(`Reconnection attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000);
      } else {
        console.error("Maximum reconnection attempts reached. Please check WebSocket server status.");
      }
    };

    this.socket.onerror = (error: Event) => {
      console.error("WebSocket error:", error);
      console.error("Connection state:", this.socket?.readyState);
      console.error("Please ensure WebSocket server is running at", WS_URL);
    };
  }

  private handleMessage(data: WebSocketMessage): void {
    const { type } = data;

    if (this.eventListeners[type]) {
      this.eventListeners[type].forEach((listener) => listener(data));
    }

    if (this.eventListeners["*"]) {
      this.eventListeners["*"].forEach((listener) => listener(data));
    }
  }

  public send(message: SimulationMessage): void {
    if (this.isConnected && this.socket) {
      this.socket.send(JSON.stringify(message));
    } else {
      // Queue the message to be sent when connection is established
      this.messageQueue.push(message);
      
      // If we're not connected, try to reconnect
      if (!this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.connect();
      }
    }
  }

  public on(
    event: string,
    callback: (data: WebSocketMessage) => void
  ): () => void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }

    this.eventListeners[event].push(callback);

    // Return a function to remove the listener
    return () => {
      this.eventListeners[event] = this.eventListeners[event].filter(
        (cb) => cb !== callback
      );
    };
  }

  public startSimulation(options: SimulationOptions): void {
    this.send({
      type: "START_SIMULATION",
      waypoints: options.waypoints,
      speed: options.speed,
    });
  }

  public pauseSimulation(): void {
    this.send({ type: "PAUSE_SIMULATION" });
  }

  public resumeSimulation(): void {
    this.send({ type: "RESUME_SIMULATION" });
  }

  public stopSimulation(): void {
    this.send({ type: "STOP_SIMULATION" });
  }

  public updateSpeed(speed: number): void {
    this.send({ type: "UPDATE_SPEED", speed });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
  }
}

// Create and export a singleton instance
export const simulationSocket = new SimulationSocket();