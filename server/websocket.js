import { WebSocketServer } from "ws";

export class WebSocketManager {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Set();

    this.wss.on("connection", (ws) => {
      console.log("[WS] Client connected");
      this.clients.add(ws);

      ws.on("close", () => {
        console.log("[WS] Client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (err) => {
        console.error("[WS] Client error:", err.message);
        this.clients.delete(ws);
      });
    });
  }

  broadcast(event, data) {
    const message = JSON.stringify({ event, data });
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  sendStatus(status, message) {
    this.broadcast("status", { status, message });
  }

  sendTranscript(transcript) {
    this.broadcast("transcript", transcript);
  }

  sendSuggestion(suggestion) {
    this.broadcast("suggestion", suggestion);
  }

  sendError(error) {
    this.broadcast("error", { message: error });
  }
}
