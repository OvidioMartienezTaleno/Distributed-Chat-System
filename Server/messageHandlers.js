// messageHandlers.js
const fetch = require('node-fetch'); // Make sure to install: npm install node-fetch@2

// --- Encryption/Decryption ---

function encryptMessage(message, shift) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const shiftAmount = shift % 26;

    return message.split('').map(char => {
        const index = alphabet.indexOf(char);
        if (index === -1) {
            return char; // Keep non-alphabetic characters as is
        }
        const isUpperCase = char === char.toUpperCase();
        const baseIndex = isUpperCase ? 0 : 26;
        // Ensure the new index wraps correctly for both positive and negative shifts
        let newIndex = (index - baseIndex + shiftAmount);
        if (newIndex < 0) newIndex += 26; // Handle negative wrap-around
        newIndex = (newIndex % 26) + baseIndex;

        return alphabet[newIndex];
    }).join('');
}

function decryptMessage(encryptedMessage) {
    // The decryption shift is the inverse of the encryption shift (3) modulo 26
    const decryptShift = (26 - (3 % 26)) % 26;
    return encryptMessage(encryptedMessage, decryptShift);
}


// --- Translation ---

// Variable para almacenar el resultado de la funcion enviarTraduccion.
let resultadoTraducido;

// Funcion para conectar con el script de python(API) y traer el json con la traduccion.
async function enviarTraduccion(texto) {
    // URL con la dirección y el puerto donde se está ejecutando el servidor Flask
    const url = 'http://127.0.0.1:5000/traduccion'; // Ensure Flask server is running

    try {
        const response = await fetch(url, {
            method: 'POST', // Método HTTP POST para enviar datos
            headers: {
                'Content-Type': 'application/json' // Tipo de contenido JSON
            },
            body: JSON.stringify({ text: texto }) // El cuerpo de la solicitud con el texto que quieres traducir
        });
        if (!response.ok) {
            throw new Error(`Error en la solicitud al servidor Flask: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        resultadoTraducido = data.translatedText || data.error; // Asigna el resultado a la variable
    } catch (error) {
        console.error('Error al conectarse con el servidor Flask:', error);
        resultadoTraducido = `Error: Could not translate. (${error.message})`; // Provide feedback
    }
    return resultadoTraducido;
}


// --- Message Handling ---

// Helper to get current timestamp string
function getCurrentTimestamp() {
    return new Date().toISOString(); // Use ISO format for consistency
}

// Helper to get formatted date/time string based on requirement
function newDateR(valor) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    if (valor === 1) { // Full date and time
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    if (valor === 2) { // Date only
        return `${year}-${month}-${day}`;
    }
    return now.toISOString(); // Default to ISO string
}


// Send a translated response back (used after calling translation API)
function returnHandleSendMessage(ws, receiver_id, content, db, clients, wss) {
    const sender = clients.get(ws);
    if (!sender) return;

    const timestamp = getCurrentTimestamp();
    const messageData = {
        sender_id: receiver_id, // Simulate sender as the original receiver (the bot/translator)
        receiver_id: sender.id, // Send back to the original sender
        content: content,       // The translated (and possibly encrypted) content
        timestamp: timestamp,
        file_name: null,        // Ensure file fields are null for text messages
        file_type: null,
        file_size: null
    };

    const stmt = db.prepare(`
    INSERT INTO messages (sender_id, receiver_id, content, timestamp, file_name, file_type, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    stmt.run(
        messageData.sender_id,
        messageData.receiver_id,
        messageData.content,
        messageData.timestamp,
        messageData.file_name,
        messageData.file_type,
        messageData.file_size,
        function (err) {
            if (err) {
                console.error("Error saving returned message:", err.message);
                ws.send(JSON.stringify({
                    type: 'message_sent_error', // Use a distinct error type
                    success: false,
                    message: 'Error saving translated response'
                }));
            } else {
                messageData.id = this.lastID; // Add the ID to the data

                // Send confirmation back to the original sender (now recipient of translation)
                ws.send(JSON.stringify({
                    type: 'new_message', // Treat it as a new incoming message for the user
                    success: true,
                    message: messageData,
                     sender: { // Identify the "sender" as the bot/translator
                         id: receiver_id, // The ID of the translator service/user
                         fullname: "Translator Bot" // Or get name if it's a real user
                    }
                }));
                 // No need to notify the "receiver" (the bot) in this case
            }
        });
    stmt.finalize();
}

// Handle sending a regular text message
function handleSendMessage(ws, data, db, clients, wss) {
    const { receiver_id, content } = data;
    const sender = clients.get(ws);
    if (!sender) return;

    const timestamp = getCurrentTimestamp();
    const stmt = db.prepare(`
    INSERT INTO messages (sender_id, receiver_id, content, timestamp, file_name, file_type, file_size)
    VALUES (?, ?, ?, ?, NULL, NULL, NULL)  -- Ensure file fields are NULL
  `);

    stmt.run(sender.id, receiver_id, content, timestamp, function (err) {
        if (err) {
            console.error("Error sending message:", err.message);
            ws.send(JSON.stringify({
                type: 'message_sent',
                success: false,
                message: 'Error al enviar el mensaje'
            }));
        } else {
            const messageData = {
                id: this.lastID,
                sender_id: sender.id,
                receiver_id: receiver_id,
                content: content,
                timestamp: timestamp, // Use consistent timestamp
                file_name: null,
                file_type: null,
                file_size: null
            };

            // Send confirmation to the sender
            ws.send(JSON.stringify({
                type: 'message_sent',
                success: true,
                message: messageData
            }));

            // If receiver is the translator bot (ID 1), process translation
            if (receiver_id === 1) {
                try {
                    const decryptedContent = decryptMessage(content);
                    enviarTraduccion(decryptedContent).then(translatedText => {
                       if (translatedText && !translatedText.startsWith("Error:")) {
                            const encryptedTranslation = encryptMessage(translatedText, 3);
                            returnHandleSendMessage(ws, receiver_id, encryptedTranslation, db, clients, wss);
                        } else {
                             // Handle translation error - maybe send an error message back
                             returnHandleSendMessage(ws, receiver_id, `Translation failed: ${translatedText}`, db, clients, wss);
                        }
                    }).catch(translationError => {
                         console.error("Translation promise error:", translationError);
                         returnHandleSendMessage(ws, receiver_id, "Error during translation process.", db, clients, wss);
                    });
                } catch (e) {
                    console.error("Decryption/Encryption error:", e);
                     returnHandleSendMessage(ws, receiver_id, "Error processing message for translation.", db, clients, wss);
                }
            } else {
                 // Notify the actual receiver if they are online
                 wss.clients.forEach(client => {
                    const receiverWs = clients.get(client);
                    if (receiverWs && receiverWs.id === receiver_id && client !== ws && client.readyState === client.OPEN) {
                        client.send(JSON.stringify({
                            type: 'new_message',
                            message: messageData,
                            sender: {
                                id: sender.id,
                                fullname: sender.fullname
                            }
                        }));
                    }
                 });
            }
        }
    });
    stmt.finalize();
}

// Handle sending a file
function handleSendFile(ws, data, db, clients, wss) {
    const { receiver_id, file_name, file_type, file_size, content } = data; // content here is the file data (e.g., base64)
    const sender = clients.get(ws);
    if (!sender) return;

    const timestamp = getCurrentTimestamp();
    const stmt = db.prepare(`
    INSERT INTO messages (sender_id, receiver_id, content, file_name, file_type, file_size, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    stmt.run(sender.id, receiver_id, content, file_name, file_type, file_size, timestamp, function (err) {
        if (err) {
            console.error("Error sending file:", err.message);
            ws.send(JSON.stringify({
                type: 'message_sent', // Use same type for consistency, or 'file_sent'
                success: false,
                message: 'Error al enviar el archivo'
            }));
        } else {
            const messageData = {
                id: this.lastID,
                sender_id: sender.id,
                receiver_id: receiver_id,
                content: content, // Include content (file data) if needed by client immediately
                file_name: file_name,
                file_type: file_type,
                file_size: file_size,
                timestamp: timestamp
            };

            // Send confirmation to sender
            ws.send(JSON.stringify({
                type: 'message_sent', // or 'file_sent'
                success: true,
                message: messageData
            }));

            // Notify receiver
            wss.clients.forEach(client => {
                const receiverWs = clients.get(client);
                if (receiverWs && receiverWs.id === receiver_id && client !== ws && client.readyState === client.OPEN) {
                    client.send(JSON.stringify({
                        type: 'new_message', // or 'new_file'
                        message: messageData,
                        sender: {
                            id: sender.id,
                            fullname: sender.fullname
                        }
                    }));
                }
            });
        }
    });
    stmt.finalize();
}


// Get message history between two users
function handleGetMessages(ws, data, db, clients) {
    const { other_user_id } = data;
    const currentUser = clients.get(ws);
    if (!currentUser) return;

    db.all(`
    SELECT id, sender_id, receiver_id, content, file_name, file_type, file_size, timestamp
    FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY timestamp ASC
  `, [currentUser.id, other_user_id, other_user_id, currentUser.id], (err, rows) => {
        if (err) {
            console.error("Error getting messages:", err.message);
            ws.send(JSON.stringify({
                type: 'messages_history',
                success: false,
                message: 'Error al obtener mensajes'
            }));
        } else {
            ws.send(JSON.stringify({
                type: 'messages_history',
                success: true,
                messages: rows
            }));
        }
    });
}


// Helper to notify receiver about deletion/edit
function notifyReceiverOfChange(receiverId, messageId, changeType, newContent, clients, wss) {
    wss.clients.forEach(client => {
        const userData = clients.get(client);
        if (userData && userData.id === receiverId && client.readyState === client.OPEN) {
             const notification = {
                type: changeType, // e.g., 'message_deleted', 'message_edited'
                success: true,
                message_id: messageId,
            };
            if (newContent !== undefined) { // Include content only for edits
                notification.content = newContent;
            }
             client.send(JSON.stringify(notification));
        }
    });
}


// Delete a message
function handleDeleteMessage(ws, data, db, clients, wss) {
    const currentUser = clients.get(ws);
    const messageId = data.message_id;
    if (!currentUser) return;

    // First, verify the user owns the message
    db.get('SELECT receiver_id FROM messages WHERE id = ? AND sender_id = ?', [messageId, currentUser.id], (err, message) => {
        if (err || !message) {
            ws.send(JSON.stringify({
                type: 'message_deleted',
                success: false,
                message: err ? 'Database error' : 'Message not found or not authorized'
            }));
            return;
        }

        // Proceed with deletion
        db.run('DELETE FROM messages WHERE id = ?', [messageId], (deleteErr) => {
            if (deleteErr) {
                console.error("Error deleting message:", deleteErr.message);
                ws.send(JSON.stringify({
                    type: 'message_deleted',
                    success: false,
                    message: 'Error deleting message'
                }));
            } else {
                // Confirm deletion to the sender
                ws.send(JSON.stringify({
                    type: 'message_deleted',
                    success: true,
                    message_id: messageId // Send back ID for client UI update
                }));
                // Notify the receiver
                notifyReceiverOfChange(message.receiver_id, messageId, 'message_deleted', undefined, clients, wss);
            }
        });
    });
}

// Edit a message
function handleEditMessage(ws, data, db, clients, wss) {
    const currentUser = clients.get(ws);
    const { message_id, content } = data;
    if (!currentUser) return;

    // Verify ownership first
     db.get('SELECT receiver_id FROM messages WHERE id = ? AND sender_id = ?', [message_id, currentUser.id], (err, message) => {
        if (err || !message) {
             ws.send(JSON.stringify({
                type: 'message_edited',
                success: false,
                message_id: message_id,
                message: err ? 'Database error' : 'Message not found or not authorized'
            }));
            return;
        }

        // Update the message content
        db.run('UPDATE messages SET content = ? WHERE id = ?', [content, message_id], (updateErr) => {
            if (updateErr) {
                console.error("Error editing message:", updateErr.message);
                 ws.send(JSON.stringify({
                    type: 'message_edited',
                    success: false,
                    message_id: message_id,
                    message: 'Error updating message'
                }));
            } else {
                // Respond to the editor
                ws.send(JSON.stringify({
                    type: 'message_edited',
                    success: true,
                    message_id: message_id,
                    content: content // Send back the updated content
                }));
                // Notify the receiver
                notifyReceiverOfChange(message.receiver_id, message_id, 'message_edited', content, clients, wss);
            }
        });
    });
}


module.exports = {
    handleSendMessage,
    handleSendFile,
    handleGetMessages,
    handleDeleteMessage,
    handleEditMessage,
    // No need to export helpers like encrypt, decrypt, translate if only used internally here
    newDateR // Export if needed elsewhere (e.g., userHandlers)
};