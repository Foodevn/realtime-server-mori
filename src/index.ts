import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import { authMiddleware } from './middleware/auth';
import { setupYjsSync } from './yjs/setupYjsSync';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const httpServer = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Realtime server is running');
});

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Apply auth middleware before any connection handler
io.use(authMiddleware);

// Set up Yjs synchronization handlers
setupYjsSync(io);

httpServer.listen(PORT, () => {
  console.log(`✅ Realtime server listening on port ${PORT}`);
  console.log(`   CORS origin: ${CLIENT_URL}`);
});
