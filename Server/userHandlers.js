// userHandlers.js
const WebSocket = require('ws'); // Needed for broadcastUsersList readyState check
const { newDateR } = require('./messageHandlers'); // Import shared utility

// --- User Authentication and Info ---

function handleRegister(ws, data, db) {
    const { username, password, fullname } = data;
    // Basic validation (consider adding more robust checks)
    if (!username || !password || !fullname) {
         ws.send(JSON.stringify({
            type: 'register',
            success: false,
            message: 'Username, password, and full name are required.'
        }));
        return;
    }

    const stmt = db.prepare(`INSERT INTO user (user_name, password, full_name) VALUES (?, ?, ?)`);
    stmt.run(username, password, fullname, function (err) {
        if (err) {
            // Handle potential unique constraint violation gracefully
            const message = err.message.includes('UNIQUE constraint failed')
                ? 'Username already exists.'
                : 'Error al registrar el usuario.';
             ws.send(JSON.stringify({
                type: 'register',
                success: false,
                message: message
            }));
        } else {
            ws.send(JSON.stringify({
                type: 'register',
                success: true,
                message: 'Registro exitoso.'
            }));
        }
    });
    stmt.finalize();
}

function handleLogin(ws, data, db, clients, wss) {
    const { username, password } = data;
    if (!username || !password) {
         ws.send(JSON.stringify({
            type: 'login',
            success: false,
            message: 'Username and password are required.'
        }));
        return;
    }

    db.get('SELECT id, user_name, full_name FROM user WHERE user_name = ? AND password = ?',
        [username, password], // Consider hashing passwords in a real app!
        (err, row) => {
            if (err) {
                console.error("Login DB error:", err.message);
                ws.send(JSON.stringify({
                    type: 'login',
                    success: false,
                    message: 'Error en el servidor'
                }));
            } else if (row) {
                // Store user data associated with this WebSocket connection
                const userData = {
                    id: row.id,
                    username: row.user_name,
                    fullname: row.full_name
                };
                clients.set(ws, userData);

                // Add to online users table (if not already there)
                 db.run('INSERT OR IGNORE INTO online_users (id) VALUES (?)', [row.id], (onlineErr) => {
                     if (onlineErr) console.error("Error adding user to online_users:", onlineErr.message);
                     else console.log(`User ${row.id} marked as online.`);
                     // Broadcast updated list after potentially adding user
                     broadcastUsersList(db, wss, clients); // Broadcast after successful login
                 });


                ws.send(JSON.stringify({
                    type: 'login',
                    success: true,
                    user: userData
                }));

                // broadcastUsersList(db, wss, clients); // Broadcast now moved inside INSERT callback

            } else {
                ws.send(JSON.stringify({
                    type: 'login',
                    success: false,
                    message: 'Usuario o contraseña incorrectos'
                }));
            }
        });
}

// Handle case where user reconnects or identifies themselves after connection
function handleUserConnected(ws, data, db, clients, wss) {
     const { userId } = data;
     if (!userId || userId === 0) {
         console.log("Received user_connected event with invalid userId:", userId);
         // Optionally send an error back to the client
         // ws.send(JSON.stringify({ type: 'user_connected_error', message: 'Invalid user ID' }));
         return;
     }

    // Check if this ws already has user data
    if (clients.has(ws)) {
        console.log(`WebSocket connection already associated with user ${clients.get(ws).id}. Ignoring new user_connected for ${userId}.`);
        return; // Avoid re-associating
    }

    db.get('SELECT id, user_name, full_name FROM user WHERE id = ?', [userId], (err, row) => {
        if (err) {
            console.error("Error fetching user data for user_connected:", err.message);
            // Optionally notify client
        } else if (row) {
            const userData = {
                id: row.id,
                username: row.user_name,
                fullname: row.full_name
            };
            clients.set(ws, userData);
            console.log(`User ${userId} (${userData.username}) connected and identified.`);

             // Mark as online (safer to do it here again)
             db.run('INSERT OR IGNORE INTO online_users (id) VALUES (?)', [userId], (onlineErr) => {
                 if (onlineErr) console.error("Error adding user to online_users:", onlineErr.message);
                  broadcastUsersList(db, wss, clients); // Broadcast after identifying
             });

        } else {
             console.warn(`User connected event for non-existent user ID: ${userId}`);
             // Optionally notify client
        }
    });
}


// Get list of all users
function handleGetUsers(ws, db) {
    db.all('SELECT id, user_name, full_name FROM user', [], (err, rows) => {
        if (err) {
             console.error("Error getting user list:", err.message);
            ws.send(JSON.stringify({
                type: 'users_list',
                success: false,
                message: 'Error al obtener usuarios'
            }));
        } else {
            ws.send(JSON.stringify({
                type: 'users_list',
                success: true,
                users: rows
            }));
        }
    });
}

// Broadcast the list of all users to everyone connected
function broadcastUsersList(db, wss, clients) {
     // Fetch all users from the user table
     db.all('SELECT id, user_name, full_name FROM user', [], (err, allUsers) => {
         if (err) {
             console.error("Error fetching users for broadcast:", err.message);
             return;
         }

        // Fetch IDs of currently online users
        db.all('SELECT id FROM online_users', [], (onlineErr, onlineRows) => {
            if (onlineErr) {
                console.error("Error fetching online users for broadcast:", onlineErr.message);
                 // Proceed without online status if this fails, or handle error differently
                 onlineRows = [];
            }

             const onlineUserIds = new Set(onlineRows.map(row => row.id));

             // Enhance the user list with online status
             const usersWithStatus = allUsers.map(user => ({
                 ...user,
                 isOnline: onlineUserIds.has(user.id)
             }));


            const message = JSON.stringify({
                type: 'users_list', // Reuse the same type, client needs to handle updates
                success: true,
                users: usersWithStatus // Send the enhanced list
            });

            wss.clients.forEach(client => {
                // Check if the client is still connected and ready
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
             console.log(`Broadcasted user list with online status to ${wss.clients.size} clients.`);
        });
     });
}

// Handle user logging out or disconnecting
function removeUserFromOnline(userId, db, wss, clients) {
    if (!userId) return;

    const query = `DELETE FROM online_users WHERE id = ?`;
    db.run(query, [userId], (err) => {
        if (err) {
            console.error(`Error removing user ${userId} from online_users:`, err.message);
        } else {
            console.log(`User ${userId} marked as offline.`);
             broadcastUsersList(db, wss, clients); // Broadcast updated list after removal
        }
    });
}


// --- Friend Management ---

function handleGetFriends(ws, data, db, clients) {
    const { userId } = data; // Assuming client sends { type: 'get_friends', data: { userId: id } }
     const currentUser = clients.get(ws);

     // Basic security check: Does the requesting user match the userId they are asking for?
     if (!currentUser || currentUser.id !== userId) {
         console.warn(`Unauthorized friend list request: Requester ${currentUser?.id}, Target ${userId}`);
         ws.send(JSON.stringify({
            type: 'friends_list',
            success: false,
            message: 'Unauthorized request'
        }));
         return;
     }


    db.all(`
    SELECT u.id, u.user_name, u.full_name
    FROM friends f
    JOIN user u ON f.friend_id = u.id
    WHERE f.user_id = ?
  `, [userId], (err, rows) => {
        if (err) {
            console.error("Error getting friends list:", err.message);
            ws.send(JSON.stringify({
                type: 'friends_list',
                success: false,
                message: 'Error al obtener la lista de amigos'
            }));
        } else {
            ws.send(JSON.stringify({
                type: 'friends_list',
                success: true,
                friends: rows
            }));
        }
    });
}

function addFriendByUsername(ws, data, db, clients) {
    const { userName: friendUserName } = data; // Friend's username
    const currentUser = clients.get(ws);
    if (!currentUser) return; // Must be logged in

     if (currentUser.username === friendUserName) {
         ws.send(JSON.stringify({ type: 'add_friend_response', success: false, message: 'You cannot add yourself as a friend.' }));
         return;
     }

    // Find the friend's ID
    db.get('SELECT id FROM user WHERE user_name = ?', [friendUserName], (err, row) => {
        if (err) {
            console.error('Error searching for friend username:', err.message);
            ws.send(JSON.stringify({ type: 'add_friend_response', success: false, message: 'Error finding user.' }));
            return;
        }
        if (!row) {
            ws.send(JSON.stringify({ type: 'add_friend_response', success: false, message: 'User not found.' }));
            return;
        }

        const friendId = row.id;
        const userId = currentUser.id;

        // Add relationship in both directions (user -> friend and friend -> user)
        // Use INSERT OR IGNORE to prevent errors if the relationship already exists
        const stmt = db.prepare(`INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)`);
        stmt.run(userId, friendId, friendId, userId, function (runErr) {
            if (runErr) {
                console.error("Error adding friend relationship:", runErr.message);
                ws.send(JSON.stringify({ type: 'add_friend_response', success: false, message: 'Could not add friend.' }));
            } else {
                // Check if rows were actually changed (i.e., relationship didn't already exist)
                 if (this.changes > 0) {
                     ws.send(JSON.stringify({ type: 'add_friend_response', success: true, message: 'Amigo agregado correctamente.' }));
                     // Optionally, trigger a friends list refresh for the user
                     handleGetFriends(ws, { userId: userId }, db, clients);
                 } else {
                     ws.send(JSON.stringify({ type: 'add_friend_response', success: false, message: 'Already friends with this user.' }));
                 }
            }
            stmt.finalize();
        });
    });
}

function deleteFriendByUsername(ws, data, db, clients) {
    const { userName: friendUserName } = data;
    const currentUser = clients.get(ws);
    if (!currentUser) return;

    // Find friend's ID
    db.get('SELECT id FROM user WHERE user_name = ?', [friendUserName], (err, row) => {
        if (err || !row) {
             ws.send(JSON.stringify({ type: 'delete_friend_response', success: false, message: err ? 'Server error' : 'User not found.' }));
            return;
        }
        const friendId = row.id;
        const userId = currentUser.id;

        // Delete relationship in both directions
        const stmt = db.prepare(`
      DELETE FROM friends
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `);
        stmt.run(userId, friendId, friendId, userId, function (runErr) {
            if (runErr) {
                console.error("Error deleting friend:", runErr.message);
                 ws.send(JSON.stringify({ type: 'delete_friend_response', success: false, message: 'Could not remove friend.' }));
            } else {
                ws.send(JSON.stringify({ type: 'delete_friend_response', success: true, message: 'Amigo eliminado correctamente.' }));
                 // Optionally, trigger a friends list refresh
                 handleGetFriends(ws, { userId: userId }, db, clients);
            }
            stmt.finalize();
        });
    });
}


// --- Temporary Messages ---

let temporaryMessageIntervals = {}; // Store interval IDs, keyed by sender+receiver pair

function registerTemporaryM(ws, data, db, clients) {
    const { sender, receiver } = data;
    const currentUser = clients.get(ws);

    // Validate request
    if (!currentUser || currentUser.id !== sender) {
        ws.send(JSON.stringify({ type: 'temporaryA', success: false, message: 'Unauthorized request.' }));
        return;
    }

    const intervalKey = `${sender}-${receiver}`; // Unique key for this pair
    const reverseKey = `${receiver}-${sender}`;

    // Stop existing intervals for this pair (either direction)
    stopTemporaryMCycle(intervalKey);
    stopTemporaryMCycle(reverseKey);

    // Record the temporary mode activation in DB
    db.run(`INSERT OR REPLACE INTO temporary (id_sender, id_receiver) VALUES (?, ?)`,
        [sender, receiver], (err) => {
            if (err) {
                console.error("Error registering temporary mode:", err.message);
                ws.send(JSON.stringify({ type: 'temporaryA', success: false, message: 'Error registering temporary mode.' }));
            } else {
                ws.send(JSON.stringify({ type: 'temporaryA', success: true, message: 'Temporary message mode activated.' }));

                // Start the deletion cycle
                const query = `DELETE FROM messages
                       WHERE (sender_id = ? AND receiver_id = ?)
                          OR (sender_id = ? AND receiver_id = ?)`;

                temporaryMessageIntervals[intervalKey] = setInterval(() => {
                    db.run(query, [sender, receiver, receiver, sender], (deleteErr) => {
                        if (deleteErr) {
                            console.error(`Error deleting temporary messages for ${intervalKey}:`, deleteErr.message);
                            // Consider stopping the interval if DB errors persist
                        } else {
                            // Optionally notify clients involved that messages were cleared
                             console.log(`Temporary messages cleared for pair ${intervalKey}`);
                            // Example notification (send to both parties if online)
                            // findClientAndSend(sender, { type: 'temp_messages_cleared' }, clients, wss);
                            // findClientAndSend(receiver, { type: 'temp_messages_cleared' }, clients, wss);
                        }
                    });
                }, 60000); // Run every 60 seconds (adjust as needed)

                console.log(`Started temporary message deletion interval for ${intervalKey}`);
            }
        });
}

function deactivateTemporaryM(ws, data, db, clients) {
     const { sender, receiver } = data;
      const currentUser = clients.get(ws);

     // Validate request
     if (!currentUser || currentUser.id !== sender) {
         ws.send(JSON.stringify({ type: 'exito', success: false, message: 'Unauthorized request.' })); // 'exito' seems like a typo, maybe 'temporaryD'?
         return;
     }

     const intervalKey = `${sender}-${receiver}`;
     const reverseKey = `${receiver}-${sender}`;

     // Stop the interval
     const stopped = stopTemporaryMCycle(intervalKey) || stopTemporaryMCycle(reverseKey);

     // Remove the record from the DB
     db.run(`DELETE FROM temporary WHERE (id_sender = ? AND id_receiver = ?) OR (id_sender = ? AND id_receiver = ?)`,
         [sender, receiver, receiver, sender], (err) => {
             if (err) {
                 console.error("Error deactivating temporary mode in DB:", err.message);
                 ws.send(JSON.stringify({ type: 'exito', success: false, message: 'Error deactivating temporary mode.' }));
             } else {
                  const message = stopped ? 'Temporary message mode deactivated.' : 'Temporary mode was not active.';
                  ws.send(JSON.stringify({ type: 'exito', success: true, message: message }));
                  console.log(`Deactivated temporary message mode for pair ${sender}-${receiver}.`);
             }
         });
}

// Helper to stop a specific interval and remove it from the store
function stopTemporaryMCycle(key) {
    if (temporaryMessageIntervals[key]) {
        clearInterval(temporaryMessageIntervals[key]);
        delete temporaryMessageIntervals[key];
        console.log(`Stopped temporary message deletion interval for ${key}`);
        return true; // Indicate that an interval was stopped
    }
    return false; // Indicate no interval was running for this key
}

// Function to stop all temporary message intervals (e.g., on server shutdown)
function stopAllTemporaryM() {
     let count = 0;
     for (const key in temporaryMessageIntervals) {
         stopTemporaryMCycle(key);
         count++;
     }
     if(count > 0) console.log(`Stopped ${count} temporary message deletion intervals.`);
}


// --- Stats ---

function countMessages(ws, db) {
    try {
        const todayDate = newDateR(2); // Get YYYY-MM-DD format

        // Combined query using subqueries
        db.get(
            `SELECT
             (SELECT COUNT(*) FROM messages) AS totalMessages,
             (SELECT COUNT(*) FROM online_users) AS totalOnlineUsers,
             (SELECT COUNT(*) FROM messages WHERE DATE(timestamp) = ?) AS messagesToday
             `,
            [todayDate], // Parameter for today's date comparison
            (err, row) => {
                if (err) {
                    console.error('Error getting message counts:', err.message);
                     ws.send(JSON.stringify({
                        type: 'count_messages_response', // Use a distinct response type
                        success: false,
                        message: 'Error getting counts'
                    }));
                } else if (row) {
                    ws.send(JSON.stringify({
                        type: 'count_messages_response',
                        success: true,
                        total: row.totalMessages,
                        totalUsers: row.totalOnlineUsers, // Renamed for clarity
                        messagesFromDate: row.messagesToday // Renamed for clarity
                    }));
                } else {
                     // Should not happen with COUNT but handle defensively
                     ws.send(JSON.stringify({
                        type: 'count_messages_response',
                        success: false,
                        message: 'Could not retrieve counts'
                    }));
                }
            }
        );
    } catch (error) {
        console.error("Exception in countMessages:", error.message);
        ws.send(JSON.stringify({
            type: 'count_messages_response',
            success: false,
            message: 'Server error while counting messages'
        }));
    }
}



module.exports = {
    handleRegister,
    handleLogin,
    handleUserConnected,
    handleGetUsers,
    broadcastUsersList,
    removeUserFromOnline,
    handleGetFriends,
    addFriendByUsername,
    deleteFriendByUsername,
    registerTemporaryM,
    deactivateTemporaryM,
    stopAllTemporaryM, // Export if needed for graceful shutdown
    countMessages,
};