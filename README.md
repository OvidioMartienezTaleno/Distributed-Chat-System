# Distributed Chat System v1.1

## Description:

This project aims to develop an advanced distributed chat system that allows users to communicate in real time through text messages and the exchange of multimedia files such as photos, videos, and audios. 
The system includes message synchronization, data encryption, user authentication, session management, and features such as reminders and alerts, all within a distributed system and process management framework.
The system also includes an Admin Mode, which allows administrators to view real-time usage statistics. Key administrative functionalities include:

- A web panel to view system activity.
- Message count tracking.
- Active user count.
- Daily message logs.
- View and manage connected users.

## Features:

- **Real-time Messaging:** Supports text-based messaging with WebSocket for live updates.
- **Multimedia Support:** Allows users to send and receive photos, videos, and audios.
- **User Authentication:** Secure user login with session management.
- **Message Synchronization:** Ensures all users see messages in real-time across all devices.
- **Admin Mode:** Admin users can view system statistics in real time.
- **WebSocket Integration:** Enables real-time message and user list updates.
- **Data Encryption:** Secure communication with robust encryption.

## Tech Stack:
- **WebSocket:** Real-time communication

- **Node.js:** JavaScript runtime for the server

- **HTML-CSS:** Frontend design

- **JavaScript:** Backend development

- **Python-FLASK:** Bot API

## Project setup:

### Server:

1. Go to server directory:

```bash
cd Server
```

2. Create and activate the virtual enviroment:

```bash
python -m venv venv
source venv/bin/activate  # Unix/Mac
.\venv\Scripts\activate   # Windows
```

3. Install dependencies:

```bash
pip install -r requirements.txt
npm install
```

4. Go to Python directory and start main.py (In order to have translation bot available):
```bash
cd Python
py main.py
```

5. Open new terminal and go to Server directory:
```bash
cd Server
```

6. activate the virtual enviroment:

```bash
source venv/bin/activate  # Unix/Mac
.\venv\Scripts\activate   # Windows
```

7. Execute server.js:
   
```bash
node server.js
```

### Client:
Simply open the HTML files in the client folder directly in browser (WebSocket server must be running).

## Credits:
### Authors:

- Ovidio Martínez Taleno
- Josseph Valverde Robles
- Gerson Vargas Gamboa

