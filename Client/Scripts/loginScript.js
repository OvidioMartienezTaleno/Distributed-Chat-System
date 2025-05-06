const wsUrl = 'ws://192.168.50.131:8080'; //Change according to the local network
const socket = new WebSocket(wsUrl);

// Check if there is already an active session
if (localStorage.getItem('currentUser')) {
    window.location.href = 'chats.html';
}

socket.onopen = () => {
    console.log('Connected to WebSocket server');
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'login') {
        if (data.success) {
            // Save user info in localStorage
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            // Redirect the user to index.html
            window.location.href = "chats.html";
        } else {
            const errorMessage = document.getElementById("error-message");
            errorMessage.style.display = "block";
            errorMessage.textContent = data.message || "Incorrect username or password.";
        }
    }
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    const errorMessage = document.getElementById("error-message");
    errorMessage.style.display = "block";
    errorMessage.textContent = 'Connection error.';
};

socket.onclose = () => {
    console.log('Connection closed');
};

document.getElementById("registro").addEventListener("click", function() {
    window.location.href = "registro.html";
});

document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");
    if(username === "Admin" && password === "BjblNjhlA"){
        window.location.href = 'Admin.html';
    } else {
        errorMessage.style.display = "none";
        errorMessage.textContent = "";

        if (username.trim() && password.trim()) {
            const loginData = {
                type: 'login',
                data: {
                    username: username,
                    password: password
                }
            };
            socket.send(JSON.stringify(loginData));
        } else {
            errorMessage.style.display = "block";
            errorMessage.textContent = "Please enter username and password.";
        }
    }
});

// Handle Enter key in input fields
document.getElementById("username").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("password").focus();
    }
});

document.getElementById("password").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("loginForm").dispatchEvent(new Event('submit'));
    }
});
