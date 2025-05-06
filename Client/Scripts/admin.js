const wsUrl = 'ws://192.168.50.131:8080'; //Change according to the local network
const socket = new WebSocket(wsUrl);
let currentUser = 0;

socket.onopen = () => {
    // Inform the server that the user is connected
    requestFriendsList();
    socket.send(JSON.stringify({
        type: 'user_connected',
        data: {
            userId: currentUser
        }
    }));
};

socket.onmessage = (event) => { 
    const data = JSON.parse(event.data);
    console.log('Message received:', data);

    switch(data.type) {
        case 'users_list':
            if (data.success) {
                updateUsersList(data.users.filter(user => user.id !== currentUser));      
            }
            break;
        case 'count_messages':
            if(data.success){
                updateStatistics(data.total, data.totalUsers, data.messagesFromDate)
            }
    }
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};

socket.onclose = () => {
    console.log('Connection closed');
};

function requestFriendsList() {
    socket.send(JSON.stringify({
        type: 'get_users',
        data: {
            userId: currentUser
        }
    }));
}

function updateUsersList(users) {
    const chatList = document.querySelector('.chat-list');
    chatList.innerHTML = ''; // Clear the user list

    // Iterate over the list of users and create an element for each one
    users.forEach(user => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item'; // Assign class for styling
        chatItem.id = `user-${user.id}`; // Assign a unique ID
        chatItem.innerHTML = `
            <div class="chat-item-content">
                <strong>${user.full_name}</strong><br>
                <span class="username">@${user.user_name}</span>
            </div>
        `;
        
        // Add a click event to select the user
        chatItem.addEventListener('click', () => selectUser(user));

        // Add the chat item to the list
        chatList.appendChild(chatItem);
    });
}

function mostrarEstadisticas() {
    // Hide other sections if necessary
    document.getElementById('output').style.display = 'none'; // Hide the output div
    
    const statsDiv = document.getElementById('statistics');
    statsDiv.classList.remove('hidden'); // Remove the 'hidden' class to show it

    socket.send(JSON.stringify({
        type: 'count_messages_request'
    }));
    
}
setInterval(mostrarEstadisticas, 10000);

setTimeout(() => {
    clearInterval(intervalId);
}, 20000); // Stop after 20 seconds

function updateStatistics(totalMessages, activeUsers, dailyMessages) {
    document.getElementById('total-messages').textContent = totalMessages;
    document.getElementById('active-users').textContent = activeUsers;
    document.getElementById('daily-messages-chart').textContent = dailyMessages;
}
