// websocketHandler.js
const WebSocket = require('ws');
const db = require('./database'); // Import the initialized DB connection
const messageHandlers = require('./messageHandlers');
const userHandlers = require('./userHandlers');

// Map to store client WebSocket connections and associated user data
const clients = new Map(); // Map<WebSocket, UserData>

function startWebSocketServer(httpServer) {
    const wss = new WebSocket.Server({ server: httpServer });
    console.log('WebSocket server started and attached to HTTP server.');

    wss.on('connection', (ws) => {
        console.log(`Client connected. Total clients: ${wss.clients.size}`);
        // Note: User is initially unknown until login or user_connected message

        ws.on('message', (message) => {
            // console.log(`Raw message received: ${message}`); // Debugging raw message
             let parsedMessage;
             try {
                 // Handle potential binary data (files) - if files are sent as ArrayBuffer/Blob
                 if (message instanceof Buffer) {
                      // Attempt to parse if it's expected JSON in buffer, otherwise handle as binary
                      try {
                           parsedMessage = JSON.parse(message.toString());
                           console.log(`Parsed Buffer message:`, parsedMessage.type);
                      } catch (bufferParseError) {
                           console.error('Received binary message that could not be parsed as JSON.');
                           // Decide how to handle raw binary data if needed,
                           // maybe based on context or a preceding metadata message.
                           // For now, we'll ignore it if it's not JSON.
                           return;
                      }
                 } else if (typeof message === 'string'){
                      parsedMessage = JSON.parse(message);
                      console.log(`Parsed String message:`, parsedMessage.type);
                 } else {
                      console.error('Received unexpected message type:', typeof message);
                      return;
                 }


                 // Basic validation
                 if (!parsedMessage || typeof parsedMessage.type !== 'string') {
                     console.error('Invalid message format received:', parsedMessage);
                      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format.' }));
                     return;
                 }

                 // Route message based on type
                 // Pass necessary dependencies (ws, data, db, clients, wss) to handlers
                 switch (parsedMessage.type) {
                     // User Handlers
                     case 'register':
                         userHandlers.handleRegister(ws, parsedMessage.data, db);
                         break;
                     case 'login':
                         userHandlers.handleLogin(ws, parsedMessage.data, db, clients, wss);
                         break;
                     case 'get_users':
                         // userHandlers.handleGetUsers(ws, db); // Fetches all users
                         userHandlers.broadcastUsersList(db, wss, clients); // More common to broadcast on change/request
                         break;
                     case 'user_connected': // When client identifies itself after connection
                         userHandlers.handleUserConnected(ws, parsedMessage.data, db, clients, wss);
                         break;
                     case 'get_friends':
                          userHandlers.handleGetFriends(ws, parsedMessage.data, db, clients);
                          break;
                     case 'add_friend':
                          userHandlers.addFriendByUsername(ws, parsedMessage.data, db, clients);
                          break;
                     case 'delete_friend':
                          userHandlers.deleteFriendByUsername(ws, parsedMessage.data, db, clients);
                          break;
                      case 'count_messages_request':
                          userHandlers.countMessages(ws, db);
                          break;
                     case 'log_out': // Client explicitly logs out
                           const loggedOutUser = clients.get(ws);
                           if (loggedOutUser) {
                                userHandlers.removeUserFromOnline(loggedOutUser.id, db, wss, clients);
                                clients.delete(ws); // Remove from active clients map
                                console.log(`User ${loggedOutUser.id} logged out.`);
                                // Optionally send confirmation to the client before closing
                                // ws.send(JSON.stringify({ type: 'logout_success' }));
                                // ws.close();
                           }
                           break; // Make sure log_out has a break

                     // Temporary Messages
                     case 'temporaryM': // Activate
                          userHandlers.registerTemporaryM(ws, parsedMessage.data, db, clients);
                          break;
                     case 'deactivateT': // Deactivate
                          userHandlers.deactivateTemporaryM(ws, parsedMessage.data, db, clients);
                          // Note: stopTemporaryM() called internally by deactivateTemporaryM
                          break;

                     // Message Handlers
                     case 'send_message':
                         messageHandlers.handleSendMessage(ws, parsedMessage.data, db, clients, wss);
                         break;
                     case 'get_messages':
                         messageHandlers.handleGetMessages(ws, parsedMessage.data, db, clients);
                         break;
                     case 'delete_message':
                         messageHandlers.handleDeleteMessage(ws, parsedMessage.data, db, clients, wss);
                         break;
                     case 'edit_message':
                         messageHandlers.handleEditMessage(ws, parsedMessage.data, db, clients, wss);
                         break;
                     case 'send_file':
                          // Ensure parsedMessage contains the necessary file data
                          messageHandlers.handleSendFile(ws, parsedMessage.data, db, clients, wss);
                          break;

                     default:
                         console.log(`Received unknown message type: ${parsedMessage.type}`);
                         ws.send(JSON.stringify({ type: 'error', message: `Unknown command: ${parsedMessage.type}` }));
                 }

             } catch (error) {
                 console.error('Error processing message:', error);
                 console.error('Original message:', message.toString()); // Log the problematic message
                 // Avoid crashing the server, notify client if possible
                  if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message.' }));
                  }
             }
        });

        ws.on('close', (code, reason) => {
            const user = clients.get(ws);
            console.log(`Client disconnected. Code: ${code}, Reason: ${reason ? reason.toString() : 'N/A'}. Total clients: ${wss.clients.size}`);
            if (user) {
                console.log(`User ${user.id} (${user.username}) disconnected.`);
                userHandlers.removeUserFromOnline(user.id, db, wss, clients); // Mark as offline
                clients.delete(ws); // Remove from the active clients map
                // No need to broadcast here, removeUserFromOnline already does
            } else {
                console.log("Disconnected client was not logged in or identified.");
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            // Clean up associated user state if an error occurs and connection likely drops
             const user = clients.get(ws);
             if (user) {
                 console.error(`Error occurred for user ${user.id}. Cleaning up.`);
                 userHandlers.removeUserFromOnline(user.id, db, wss, clients);
                 clients.delete(ws);
             }
             // ws.close() might be redundant if the error leads to a close event anyway
        });
    });

    // Optional: Handle server-wide errors
    wss.on('error', (error) => {
        console.error('WebSocket Server error:', error);
    });

     // Optional: Graceful shutdown handling
     process.on('SIGINT', () => {
         console.log('SIGINT received. Shutting down WebSocket server...');
         userHandlers.stopAllTemporaryM(); // Stop any running temporary message cycles
         wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                  client.close(1012, "Server shutting down"); // Notify clients
              }
         });
         wss.close(() => {
              console.log('WebSocket server closed.');
              // Close DB connection if needed (depends on app structure)
              // db.close();
              process.exit(0);
         });
         // Force close after a timeout if graceful close fails
          setTimeout(() => {
              console.error("Graceful shutdown timed out. Forcing exit.");
              process.exit(1);
          }, 5000); // 5 seconds timeout
     });


    return wss; // Return the server instance if needed elsewhere
}

module.exports = { startWebSocketServer, clients }; // Export clients map if needed by other modules directly (though passing is often better)