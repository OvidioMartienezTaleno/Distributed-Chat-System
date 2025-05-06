// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Determine the correct path to the database file
const dbPath = path.join(__dirname, 'dataBase', 'psi.db'); // Assumes 'dataBase' folder is in the same directory as this script

// Ensure the directory exists (optional, but good practice if unsure)
const fs = require('fs');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
}


const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
        console.error(`Database path attempted: ${dbPath}`);
        process.exit(1); // Exit if DB connection fails
    } else {
        console.log(`Conectado a la base de datos SQLite en: ${dbPath}`);
        setupDatabaseSchema();
    }
});

function setupDatabaseSchema() {
    db.serialize(() => {
        
        db.run(`
      CREATE TABLE IF NOT EXISTS user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT
      )
    `, (err) => {
            if (err) console.error('Error creating user table:', err.message);
            else console.log('User table ready.');
        });

        
        db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        receiver_id INTEGER,
        content TEXT,
        file_name TEXT DEFAULT NULL,
        file_type TEXT DEFAULT NULL,
        file_size INTEGER DEFAULT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES user(id),
        FOREIGN KEY (receiver_id) REFERENCES user(id)
      )
    `, (err) => {
            if (err) {
                console.error('Error creating/checking messages table:', err.message);
            } else {
                console.log('Messages table created or already exists.');
                // Check and add columns if they don't exist (safer approach)
                addColumnIfNotExists('messages', 'file_name', 'TEXT DEFAULT NULL');
                addColumnIfNotExists('messages', 'file_type', 'TEXT DEFAULT NULL');
                addColumnIfNotExists('messages', 'file_size', 'INTEGER DEFAULT NULL');
            }
        });

        // Crear tabla de amigos
        db.run(`
      CREATE TABLE IF NOT EXISTS friends (
          user_id INTEGER,
          friend_id INTEGER,
          PRIMARY KEY (user_id, friend_id),
          FOREIGN KEY (user_id) REFERENCES user(id),
          FOREIGN KEY (friend_id) REFERENCES user(id)
      )
     `, (err) => {
            if (err) console.error('Error creating friends table:', err.message);
            else console.log('Friends table ready.');
        });

        // Crear tabla de usuarios online (simplificada)
        db.run(`
       CREATE TABLE IF NOT EXISTS online_users (
           id INTEGER PRIMARY KEY,
           FOREIGN KEY (id) REFERENCES user(id)
       )
      `, (err) => {
            if (err) console.error('Error creating online_users table:', err.message);
            else console.log('Online_users table ready.');
        });

        // Crear tabla de mensajes temporales
        db.run(`
       CREATE TABLE IF NOT EXISTS temporary (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           id_sender INTEGER,
           id_receiver INTEGER,
           FOREIGN KEY (id_sender) REFERENCES user(id),
           FOREIGN KEY (id_receiver) REFERENCES user(id)
       )
      `, (err) => {
            if (err) console.error('Error creating temporary table:', err.message);
            else console.log('Temporary table ready.');
        });
    });
}

// Helper function to add a column only if it doesn't exist
function addColumnIfNotExists(tableName, columnName, columnDefinition) {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
        if (err) {
            console.error(`Error checking table info for ${tableName}:`, err.message);
            return;
        }
        const columnExists = columns.some(col => col.name === columnName);
        if (!columnExists) {
            db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`, (alterErr) => {
                if (alterErr) {
                    console.error(`Error adding column ${columnName} to ${tableName}:`, alterErr.message);
                } else {
                    console.log(`Column ${columnName} added to ${tableName}.`);
                }
            });
        } else {
             // Optional: Log that column already exists
             // console.log(`Column ${columnName} already exists in ${tableName}.`);
        }
    });
}


module.exports = db; // Export the database connection