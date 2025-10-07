# Farmer–Expert Chat System and Project Features

## Overview
This project is a full‑stack agriculture assistant with role‑based access for Farmers, Experts, and Admins. It includes authentication, user management, sowing calendar, crop profiles, schemes, market prices, farm logs, soil analysis, recommendations, and a real‑time farmer–expert chat with approval workflow.

## Chat System (Farmer ↔ Expert)
The chat feature enables one‑to‑one messaging between farmers and experts with Socket.IO for realtime delivery and a REST API for history, conversations, and approvals.

### Architecture
- Backend: Express + MongoDB (Mongoose), Socket.IO
- Models: `Conversation`, `Message`, `ChatRequest`
- REST routes: `backend/routes/chat.js`
- Realtime: Socket.IO events in `backend/server.js`
- Frontend: React `Chatbox.jsx` with `socket.js` and `chatApi` helpers

### Data Models
- `Conversation`
  - `participants: ObjectId[]` (user ids)
  - `participantEmails: string[]`
  - `lastMessageAt: Date`
  - `lastMessageText: string`
- `Message`
  - `conversationId: ObjectId`
  - `fromUserId`, `toUserId`
  - `fromEmail`, `toEmail`
  - `text` (max 2000 chars), `readAt`
- `ChatRequest` (farmer → expert approval)
  - `farmerId`, `expertId`
  - `status: 'pending' | 'approved' | 'rejected'`
  - `farmerNote`, `expertNote`, `approvedAt`, `rejectedAt`

### Approval Workflow
- Farmers must request approval before messaging experts.
- Experts can approve/reject requests.
- Only approved farmer–expert pairs can exchange messages.

### REST Endpoints (Auth required)
- `GET /api/chat/conversations` — list conversations for current user
- `POST /api/chat/conversations/by-email` — get or create conversation with peer email; enforces approval for farmer→expert
- `GET /api/chat/conversations/:id/messages` — fetch last 200 messages (chronological)
- `POST /api/chat/conversations/:id/read` — mark inbound messages as read
- `POST /api/chat/requests` — farmer creates/updates a chat request to expert by email
- `GET /api/chat/requests/pending` — expert: list pending requests
- `POST /api/chat/requests/:id/approve` — expert approves
- `POST /api/chat/requests/:id/reject` — expert rejects
- `GET /api/chat/approved-peers` — list approved peer emails for current user

### Socket.IO Events
- Client → Server: `send_message` { toUserId?, toEmail, text }
  - Persists `Message`, updates `Conversation`, emits `receive_message` to recipient rooms
  - Farmer→Expert gated by approved `ChatRequest`
- Client → Server: `typing` { toUserId?, toEmail }
  - Broadcasts `typing` to recipient rooms
- Server → Client: `receive_message` { conversationId, fromEmail, toEmail, text, ts, ... }
- Server → Client: `typing` { fromUserId, fromEmail }

### Frontend Chatbox (`frontend/src/Pages/UserDashboard/Chatbox.jsx`)
- Loads experts list: `GET /farmer/experts`
- Loads farmer’s chat requests; shows status badges and a “Request Chat” action
- Lists conversations for last message previews
- Resolves/creates conversation by expert email and loads history
- Sends messages via Socket.IO; shows typing indicator; auto‑scrolls
- Language support (English/Malayalam) for labels

### Security & Rooms
- Socket auth via JWT (Bearer token) in handshake
- Users join rooms: `user:{userId}` and `email:{email}` for robust delivery
- Basic checks for blocked/inactive users

### Limitations and Notes
- Messages limited to 2000 characters
- Typing indicator is transient (~1.5s)
- Conversation creation via email requires prior approval for farmer→expert

## Project Features (High‑level)
- Authentication & Profiles
  - JWT auth, signup/login/reset
  - Update profile, password, and avatar upload
  - Roles: `admin`, `expert`, `user` (farmer)
- Admin Panel
  - User management, deactivation/activation
  - Expert tools and acceptance tests
- Farmer Dashboard
  - Sowing calendar, crop profiles, recommendations
  - Fertilizer calculator, soil analysis, farm logbook
  - Government schemes, market price view, weather forecast, reports
  - Real‑time chat with experts (approval‑based)
- Expert Dashboard
  - Approve/reject farmer chat requests
  - Engage in real‑time chat with approved farmers
- Sowing Calendar
  - APIs, UI management, and comprehensive tests
- Notifications & Logs
  - Action logging (backend/models/ActionLog.js)

## Key Files
- Backend
  - `server.js` — Express, Socket.IO setup, message/typing handlers
  - `routes/chat.js` — chat REST API (conversations, messages, approvals)
  - `models/Conversation.js`, `models/Message.js`, `models/ChatRequest.js`
  - `routes/farmer.js`, `routes/expert.js` — supporting endpoints (experts listing, etc.)
- Frontend
  - `src/Pages/UserDashboard/Chatbox.jsx`
  - `src/services/socket.js`, `src/services/api.js` (`chatApi`)

## Run Locally
- Backend: `npm install` then `npm start` in `backend/`
- Frontend: `npm install` then `npm run dev` in `frontend/`
- Configure environment:
  - Backend `.env` or `backend/config/config.js` (PORT, MONGODB_URI, JWT_SECRET, FRONTEND_URL)
  - Frontend `src/config/config.js` (API_URL, TOKEN_KEY)

## Quick Chat Demo
1) Farmer logs in → requests chat with an expert from Chatbox list
2) Expert logs in → approves the request
3) Farmer selects expert → chat history loads → sends message
4) Expert receives message in real‑time → replies 