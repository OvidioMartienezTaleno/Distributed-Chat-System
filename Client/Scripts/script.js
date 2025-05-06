const wsUrl = 'ws://192.168.50.131:8080'; //Cambiar de acuerdo a la red locar
const socket = new WebSocket(wsUrl);
let currentUser = JSON.parse(localStorage.getItem('currentUser'));
console.log(currentUser)
let selectedUserId = null;

// Check if a user is logged in
if (!currentUser) {
    window.location.href = 'index.html';
}

socket.onopen = () => {
    requestFriendsList();
    // Inform the server that the user is connected
    socket.send(JSON.stringify({
        type: 'user_connected',
        data: {
            userId: currentUser.id
        }
    }));
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Mensaje recibido:', data);

    switch(data.type) {
        case 'friends_list':
            if (data.success) {
                updateUsersList(data.friends.filter(friend => friend.id !== currentUser.id));
                verify(data.friends.filter(friend => friend.id !== currentUser.id));     
            }
            break;
        case 'messages_history':
            if (data.success) {
                displayMessages(data.messages);
            }
            break;
        case 'message_sent':
            if (data.success) {
                appendMessage(data.message);
                // Refresh the chat view if necessary
                if (selectedUserId === data.message.receiver_id) {
                    requestMessages(selectedUserId);
                }
            }
            break;
        case 'new_message':
            // If the message is from the currently selected user, display it
            if (data.message.sender_id === selectedUserId || 
                data.message.receiver_id === selectedUserId) {
                appendMessage(data.message);
                // Refresh the chat view
                requestMessages(selectedUserId);
            } else {
                // Notify of new messages from another user
                notifyNewMessage(data.sender);
            }
            break;
        case 'users_list':
            if (data.success) {     
                requestFriendsList()      
            }
            break;
        case 'success':
            if(data.success){  
                alert(data.message);        
            }
            break;
        case 'delete':
            if(data.success){
                alert(data.message);
            }
            break;
        case 'message_deleted':
            if (data.success) {
                // Refresh the messages to show the updated list
                requestMessages(selectedUserId);
            } else {
                alert('Error deleting message: ' + data.message);
            }
            break;
        case 'temporaryA':
            if (data.success) {
                alert("Mensajes temporales activado(duracion de 24 horas.")
            }else{
                alert("Mensajes temporales ya esta activo en este chat")
            }
            break;
        case 'confirmation':
            requestMessages(selectedUserId);
            break;
        case 'exito':
            if (data.success) {
                alert("Mensajes temporales desactivados.")
            }
            break;
    }
};


socket.onerror = (error) => {
    console.error('Error en WebSocket:', error);
};

socket.onclose = () => {
    console.log('Conexión cerrada');
};

function requestFriendsList() {
    socket.send(JSON.stringify({
        type: 'get_friends',
        data: {
            userId: currentUser.id 
        }
    }));
}

function newDate(){
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const formattedDate = `${hours}:${minutes}:${seconds}`;
    return formattedDate;
}

function updateUsersList(users) {
    const chatList = document.querySelector('.chat-list');
    chatList.innerHTML = '';

    // Iterate over the list of friends or users and create an item for each one
    users.forEach(user => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.id = `user-${user.id}`;
        chatItem.innerHTML = `
            <strong>${user.full_name}</strong><br>
            <span class="username">@${user.user_name}</span>
        `;
        chatItem.addEventListener('click', () => selectUser(user));
        chatList.appendChild(chatItem);
    });
}

function verify(users){
    if(users.length === 0){
        alert("Hola " + currentUser.fullname + ", puedes agregar el boot 'Chat' para traducir al inglés.")
    }else{
        // Check if there is a user with user_name 'Chat'
        const hasChatUser = users.some(user => user.user_name === "Chat");

        // If there is no 'Chat' user, display a message
        if (!hasChatUser && users.length !== 0) {
            alert("Hola " + currentUser.fullname + ", puedes agregar el bot 'Chat' para traducir al inglés.");
        }
    }

}

function selectUser(user) {
    selectedUserId = user.id;
    document.querySelector('.chat-header div:first-child').textContent = user.full_name;
    
    // Remove notification of new messages
    document.getElementById(`user-${user.id}`).classList.remove('has-new-message');
    
    requestMessages(user.id);

    // Update active class
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(`user-${user.id}`).classList.add('active');
}

function requestMessages(userId) {
    socket.send(JSON.stringify({
        type: 'get_messages',
        data: {
            other_user_id: userId
        }
    }));
}

function displayMessages(messages) {
    const messagesContainer = document.querySelector('.messages');
    messagesContainer.innerHTML = '';

    // Sort messages by timestamp
    messages.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
    });

    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        const isSent = msg.sender_id === currentUser.id;
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        
        let messageContent = '';

        if (msg.file_type) {
            // It is a file
            const deleteButton = isSent ? `
                <button class="delete-file-btn" onclick="deleteMessage(${msg.id})">🗑️</button>
            ` : '';

            if (msg.file_type.startsWith('image/')) {
                messageContent = `
                    <div class="file-content">
                        <img src="${msg.content}" alt="Imagen" class="message-image">
                        <div class="file-info">
                            <span>${msg.file_name}</span>
                            <div class="file-actions">
                                <a href="${msg.content}" download="${msg.file_name}" class="download-button">⬇️</a>
                                ${deleteButton}
                            </div>
                        </div>
                    </div>
                `;
            } else if (msg.file_type.startsWith('video/')) {
                messageContent = `
                    <div class="file-content">
                        <video controls class="message-video">
                            <source src="${msg.content}" type="${msg.file_type}">
                        </video>
                        <div class="file-info">
                            <span>${msg.file_name}</span>
                            <div class="file-actions">
                                <a href="${msg.content}" download="${msg.file_name}" class="download-button">⬇️</a>
                                ${deleteButton}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                messageContent = `
                    <div class="file-content">
                        <div class="file-info">
                            <span>📄 ${msg.file_name}</span>
                            <div class="file-actions">
                                <a href="${msg.content}" download="${msg.file_name}" class="download-button">⬇️</a>
                                ${deleteButton}
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            // It's a normal text message
            const decryptedContent = decryptMessage(msg.content);
            messageContent = `<div class="message-content">${decryptedContent}</div>`;
        }

        // If the message was sent by the current user, add edit and delete buttons
        if (isSent) {
            messageContent += `
                <button class="message-actions-btn">⋮</button>
                <div class="message-actions-dropdown">
                    <button class="edit-message-btn">Editar mensaje</button>
                    <button class="delete-message-btn">Borrar mensaje</button>
                </div>
            `;
        }

        // Include message content and send time in the message div
        messageDiv.innerHTML = `
            ${messageContent}
            <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);

        // Add the edit event if it is a message sent by the user
        if (isSent) {
            const editBtn = messageDiv.querySelector('.edit-message-btn');
            editBtn.addEventListener('click', () => {
                const messageContentDiv = messageDiv.querySelector('.message-content');
                const currentText = messageContentDiv.textContent;

                // Create input field to edit message
                const inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.value = currentText;
                inputField.className = 'edit-message-input';

                // Create button to save the edited message
                const saveButton = document.createElement('button');
                saveButton.textContent = 'Guardar';
                saveButton.className = 'edit-save-btn';

                // Replace current content with input field and save button
                messageContentDiv.innerHTML = '';
                messageContentDiv.appendChild(inputField);
                messageContentDiv.appendChild(saveButton);

                // Focus the input field
                inputField.focus();

                // Manage the saving of the edited message
                saveButton.addEventListener('click', () => {
                    const newContent = inputField.value.trim();
                    if (newContent && newContent !== currentText) {
                        socket.send(JSON.stringify({
                            type: 'edit_message',
                            data: {
                                message_id: msg.id,
                                content: encryptMessage(newContent, 3)
                            }
                        }));
                    }
                    messageContentDiv.textContent = newContent;
                });

                // Handle the "Enter" key event to save
                inputField.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveButton.click();
                    }
                });
            });

            // Add the delete event
            const deleteBtn = messageDiv.querySelector('.delete-message-btn');
            deleteBtn.addEventListener('click', () => {
                socket.send(JSON.stringify({
                    type: 'delete_message',
                    data: {
                        message_id: msg.id
                    }
                }));
            });
        }
    });

    // Automatically scroll to the end of the message container
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


// Adds messages to the selected chat (at the top of the div)
function appendMessage(message) {
    const messagesContainer = document.querySelector('.messages');
    const messageDiv = document.createElement('div');
    const isSent = message.sender_id === currentUser.id;
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    let messageContent = '';
    
    if (message.file_type) {
        // It is a file
        const deleteButton = isSent ? `
            <button class="delete-file-btn" onclick="deleteMessage(${message.id})">🗑️</button>
        ` : '';

        if (message.file_type.startsWith('image/')) {
            messageContent = `
                <div class="file-content">
                    <img src="${message.content}" alt="Imagen" class="message-image">
                    <div class="file-info">
                        <span>${message.file_name}</span>
                        <div class="file-actions">
                            <a href="${message.content}" download="${message.file_name}" class="download-button">⬇️</a>
                            ${deleteButton}
                        </div>
                    </div>
                </div>
            `;
        } else if (message.file_type.startsWith('video/')) {
            messageContent = `
                <div class="file-content">
                    <video controls class="message-video">
                        <source src="${message.content}" type="${message.file_type}">
                    </video>
                    <div class="file-info">
                        <span>${message.file_name}</span>
                        <div class="file-actions">
                            <a href="${message.content}" download="${message.file_name}" class="download-button">⬇️</a>
                            ${deleteButton}
                        </div>
                    </div>
                </div>
            `;
        } else {
            messageContent = `
                <div class="file-content">
                    <div class="file-info">
                        <span>📄 ${message.file_name}</span>
                        <div class="file-actions">
                            <a href="${message.content}" download="${message.file_name}" class="download-button">⬇️</a>
                            ${deleteButton}
                        </div>
                    </div>
                </div>
            `;
        }
    } else {
        // It's a text message
        const decryptedContent = decryptMessage(message.content);
        messageContent = `<div class="message-content">${decryptedContent}</div>`;
    }

    messageDiv.innerHTML = `
        ${messageContent}
        <div class="message-time">${message.timestamp}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function notifyNewMessage(sender) {
    // Verify that 'sender' and 'sender.id' are valid
    if (!sender || !sender.id) {
        console.error('Sender is not valid:', sender);
        return;
    }

    // Find the corresponding user item
    const userItem = document.getElementById(`user-${sender.id}`);
    if (userItem) {
        // Add the class that indicates that there is a new message
        userItem.classList.add('has-new-message');

        // Optional: Remove the class after a while (for example, 5 seconds)
        setTimeout(() => {
            userItem.classList.remove('has-new-message');
        }, 5000);
    } else {
        console.warn(`User item with ID user-${sender.id} not found.`);
    }
}


// Configure the header with user information
document.querySelector('.chat-header').innerHTML = `
    <div>Selecciona un usuario para chatear</div>
    <div class="user-info">
        <span>Usuario: ${currentUser.fullname}</span>
        <button id="logout" class="logout-btn">Cerrar Sesión</button>
    </div>
`;

// Manage message sending
document.getElementById('sendMessage').addEventListener('click', () => {
    const inputMessage = document.getElementById('inputMessage').value.trim();
    
    if (inputMessage && selectedUserId) {
        socket.send(JSON.stringify({
            type: 'send_message',
            data: {
                receiver_id: selectedUserId,
                content: encryptMessage(inputMessage, 3)
            }
        }));
        document.getElementById('inputMessage').value = '';
    }
});

// Manage sending with Enter
document.getElementById('inputMessage').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('sendMessage').click();
    }
});

// Handle logout
document.getElementById('logout').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
    socket.send(JSON.stringify({
        type: 'log_out',
        data: {
            idUser: currentUser.id

        }
    }));

});

// Prompt para agregar amigos 
document.getElementById('addUserButton').addEventListener('click', () => {
    const userNameN = prompt('Ingrese el nombre del usuario:');
    if (userNameN) {
        
        // Inform the server of the userName and id
        socket.send(JSON.stringify({
            type: 'add_friend',
            data: {
                userName: userNameN,
                userID: currentUser.id
            }
        }));
        location.reload();
    }
});

// Button to remove friends
document.getElementById('deleteUserButton').addEventListener('click', () => {
    const userNameNe = prompt('Ingrese el nombre del usuario:');
    if (userNameNe) {
        
        // Inform the server of the userName and id
        socket.send(JSON.stringify({
            type: 'delete_friend',
            data: {
                userName: userNameNe,
                userID: currentUser.id
            }
        }));
        location.reload();
    }
});


// function to activate temporary messages.
document.getElementById('activarTemporal').addEventListener('click', () => {
    if(selectedUserId !== null){
        socket.send(JSON.stringify({
            type: 'temporaryM',
            data: {
                sender: currentUser.id,
                receiver: selectedUserId
            }
        }));
    }
});

// function to disable deletion of temporary messages:
document.getElementById('desactivarTemporal').addEventListener('click', () => {
    if(selectedUserId !== null){
        socket.send(JSON.stringify({
            type: 'deactivateT',
            data: {
                sender: currentUser.id,
                receiver: selectedUserId
            }
        }));
    }
});


document.getElementById('busqueda').addEventListener('click', () => {
    const message = prompt('Ingrese el mensaje a buscar:');
    if (message) {
        searchMessages(message);
    }
});

function searchMessages(query) {
    const messagesContainer = document.querySelector('.messages');
    const messages = messagesContainer.querySelectorAll('.message.sent'); // Selecciona todos los elementos con las clases 'message sent'

    // Clear previous results
    messages.forEach(message => message.classList.remove('highlight'));

    // Search for messages that contain the entered text
    let foundMessage = null;  // To store the first message found

    messages.forEach(message => {
        const messageText = message.textContent || message.innerText; 
        if (messageText.includes(query)) {
            message.classList.add('highlight'); 
            message.closest('.message').classList.add('highlight'); 

            if (!foundMessage) {
                foundMessage = message;  
            }
        }
    });

    if (foundMessage) {
        enedo// Move the control to the found message
        foundMessage.scrollIntoView({
            behavior: 'smooth',  
            block: 'center'      
        });
        alert('Mensaje encontrado y desplazado!');
    } else {
        alert('No se encontraron mensajes.');
    }
}

// function to open the options menu
document.getElementById("opcionesButton").addEventListener("click", function() {
    const menu = document.querySelector(".dropdown-menu");
    menu.style.display = menu.style.display === "block" ? "none" : "block";
});

// function to hide the options submenu
document.addEventListener("click", function(event) {
    const menu = document.querySelector(".dropdown-menu");
    const opcionesButton = document.getElementById("opcionesButton");

    // Closes the menu if clicked outside the "Options" button or menu
    if (event.target !== opcionesButton && !menu.contains(event.target)) {
        menu.style.display = "none";
    }
});

// Function to decrypt a message encrypted with the Caesar cipher
function decryptMessage(encryptedMessage) {
    // Reverse offset to decrypt
    const decryptShift = (26 - (3 % 26)) % 26; // displacement is positive and within the range
    return encryptMessage(encryptedMessage, decryptShift);
  }
  
// Encryption function (reused for decryption with a reverse shift)
function encryptMessage(message, shift) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const shiftAmount = shift % 26; // offset is within the range of the alphabet

    return message.split('').map(char => {
        const index = alphabet.indexOf(char);

        // If the character is not in the alphabet (spaces, punctuation, etc.), it is left as is.
        if (index === -1) {
            return char;
        }

        // Calculation of the new index and adjustment in case the end of the alphabet is exceeded
        const isUpperCase = char === char.toUpperCase();
        const baseIndex = isUpperCase ? 0 : 26; 
        const newIndex = (index - baseIndex + shiftAmount) % 26 + baseIndex;

        return alphabet[newIndex];
    }).join('');
}

//Send message when disconnecting
window.onbeforeunload = function() {
    socket.send(JSON.stringify({
        type: 'log_out',
        data: {
            idUser: currentUser.id
        }
    }));
    return null; 
};

//////////////////////////////////////////////////////


document.getElementById("mandarArchivo").addEventListener("click", function() {
    document.getElementById("fileInput").click();  // Activates the file input when the button is pressed
});

// Add after WebSocket initialization
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB size limit

// Add handler for the attach button
document.getElementById('attachButton').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

// Global variables for managing files
let filesToSend = new Map();

// Modify the file selection handler
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    const previewArea = document.getElementById('previewArea');
    previewArea.classList.add('active');
    
    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
            alert(`El archivo ${file.name} es demasiado grande. Máximo 5MB.`);
            continue;
        }

        // Create preview
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        // Generate unique ID for the file
        const fileId = Date.now() + '-' + file.name;
        filesToSend.set(fileId, file);

        // Preview content by file type
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            previewItem.appendChild(img);
        } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.controls = true;
            previewItem.appendChild(video);
        } else {
            const icon = document.createElement('div');
            icon.textContent = '📄';
            icon.style.fontSize = '2em';
            previewItem.appendChild(icon);
        }

        // File information
        const infoDiv = document.createElement('div');
        infoDiv.className = 'preview-info';
        infoDiv.innerHTML = `
            <div class="preview-name">${file.name}</div>
            <div class="preview-size">${formatFileSize(file.size)}</div>
        `;
        previewItem.appendChild(infoDiv);

        // Remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-preview';
        removeButton.textContent = '×';
        removeButton.onclick = () => {
            previewItem.remove();
            filesToSend.delete(fileId);
            if (filesToSend.size === 0) {
                previewArea.classList.remove('active');
            }
        };
        previewItem.appendChild(removeButton);

        previewArea.appendChild(previewItem);
    }
    
    // Clear input
    e.target.value = '';
});

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// Modify the submit button handler
document.getElementById('sendMessage').addEventListener('click', async () => {
    const inputMessage = document.getElementById('inputMessage').value.trim();
    const previewArea = document.getElementById('previewArea');
    
    if (selectedUserId) {
        // Send files if there are any
        if (filesToSend.size > 0) {
            for (const [fileId, file] of filesToSend) {
                const base64 = await fileToBase64(file);
                socket.send(JSON.stringify({
                    type: 'send_file',
                    data: {
                        receiver_id: selectedUserId,
                        file_name: file.name,
                        file_type: file.type,
                        file_size: file.size,
                        content: base64
                    }
                }));
            }
            // Clean files and preview
            filesToSend.clear();
            previewArea.innerHTML = '';
            previewArea.classList.remove('active');
        }

        // Send text message if there is any
        if (inputMessage) {
            socket.send(JSON.stringify({
                type: 'send_message',
                data: {
                    receiver_id: selectedUserId,
                    content: inputMessage
                }
            }));
            document.getElementById('inputMessage').value = '';
        }
    }
});

// Helper function to convert file to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Add this feature to handle message deletion
function deleteMessage(messageId) {
    if (confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
        socket.send(JSON.stringify({
            type: 'delete_message',
            data: {
                message_id: messageId
            }
        }));
    }
}