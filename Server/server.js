// server.js
const express = require('express');
const path = require('path');
const http = require('http'); // Use http module explicitly
const { startWebSocketServer } = require('./websocketHandler'); // Import the WS setup function

// --- Basic Setup ---
const app = express();
const port = process.env.PORT || 8080; // Use environment variable or default

// --- Middleware ---
// Serve static files (HTML, CSS, client-side JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- HTTP Server ---
// Create HTTP server from the Express app
const server = http.createServer(app);

// --- WebSocket Server ---
// Start the WebSocket server and attach it to the HTTP server
const wss = startWebSocketServer(server); // Initialize WebSocket handling

// --- Routes (Optional - if you need REST endpoints) ---
app.get('/', (req, res) => {
  // Serve your main HTML file, e.g., index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Add other REST API endpoints here if needed, for example:
// app.get('/api/status', (req, res) => {
//   res.json({ status: 'running', connectedClients: wss.clients.size });
// });


// --- Start Listening ---
server.listen(port, () => {
  console.log(`🚀 Servidor HTTP y WebSocket corriendo en http://localhost:${port}`);
});

// --- Error Handling (Basic) ---
server.on('error', (error) => {
    console.error('HTTP Server Error:', error);
    if (error.syscall !== 'listen') {
        throw error;
    }
    // Handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(`Port ${port} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`Port ${port} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});