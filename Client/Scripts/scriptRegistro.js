const wsUrl = 'ws://192.168.50.131:8080'; // Change according to the local network
const socket = new WebSocket(wsUrl);
const errorMessage = document.getElementById('error-message');

socket.onopen = () => {
    console.log('Connected to the WebSocket server');
};

document.getElementById('registerForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const fullname = document.getElementById('fullname').value;

    // Validations
    if (!username || !password || !confirmPassword || !fullname) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'All fields are required.';
        return;
    }

    if (password !== confirmPassword) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Passwords do not match.';
        return;
    }

    const registerData = {
        type: 'register',
        data: {
            username: username,
            password: password,
            fullname: fullname
        }
    };

    socket.send(JSON.stringify(registerData));
});

socket.onmessage = (event) => {
    try {
        const response = JSON.parse(event.data);
        console.log('Response received:', response); // For debugging

        if (response.type === 'register') {
            if (response.success) {
                alert('Registration successful');
                // Small delay before redirection
                setTimeout(() => {
                    window.location.replace('index.html');
                }, 1000);
            } else {
                errorMessage.style.display = 'block';
                errorMessage.textContent = response.message || 'Registration error.';
            }
        }
    } catch (error) {
        console.error('Error processing the response:', error);
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Error processing the response.';
    }
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    errorMessage.style.display = 'block';
    errorMessage.textContent = 'Connection error.';
};

socket.onclose = () => {
    console.log('WebSocket connection closed');
};
