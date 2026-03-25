# WhatsApp Web Clone (MERN + Socket.io)

This is a full-stack WhatsApp Web clone built using the MERN stack (MongoDB, Express, React, Node.js) and Socket.io for real-time bidirectional communication.

## Features

- **Authentication**: Simple username-based login.
- **Real-time Messaging**: Instant message delivery using Socket.io.
- **Database Persistence**: Messages and users are stored in MongoDB.
- **Responsive UI**: A modern interface heavily inspired by WhatsApp Web using Tailwind CSS.
- **Chat Features**: Auto-scroll to latest message, separate chat views.

## Technologies Used
- **Frontend**: React (Vite), Tailwind CSS, React Router, Axios, Socket.io-client, Lucide React (Icons).
- **Backend**: Node.js, Express, Mongoose, Socket.io, CORS, dotenv.
- **Database**: MongoDB

## Prerequisites
- Node.js installed on your machine.
- MongoDB running locally on port `27017` (or modify `MONGO_URI` in `backend/.env`).

## Installation & Setup

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server (runs on port 5000):
   ```bash
   node server.js
   # Or using nodemon: npm run dev (if configured)
   ```

### 2. Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server (runs on port 5173 by default):
   ```bash
   npm run dev
   ```

## Usage
1. Open your browser and go to `http://localhost:5173`.
2. Open another tab or an incognito window with the same URL to log in as a second user.
3. Enter unique usernames in both windows.
4. Select the other user from the left chat list and start sending real-time messages!

