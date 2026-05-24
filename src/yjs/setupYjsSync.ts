import type { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { getRoom } from '../rooms/roomManager';

export function setupYjsSync(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    console.log(`[YjsSync] User ${userId} connected (socket ${socket.id})`);

    // Track which boards this socket has joined, and the clientID used per board
    const joinedBoards = new Map<string, number>();

    socket.on('join-board', (boardId: string) => {
      const { doc, awareness } = getRoom(boardId);

      socket.join(boardId);

      // Assign a unique clientID per socket-board combo
      // We use a deterministic but unique value based on socket id hash
      const clientID = awareness.doc.clientID + hashCode(socket.id);
      joinedBoards.set(boardId, clientID);

      // Send full doc state to the new client
      const docState = Y.encodeStateAsUpdate(doc);
      socket.emit('yjs:sync', Buffer.from(docState));

      // Send full awareness state to the new client
      const awarenessStates = Array.from(awareness.getStates().keys());
      if (awarenessStates.length > 0) {
        const awarenessUpdate = encodeAwarenessUpdate(awareness, awarenessStates);
        socket.emit('awareness:sync', Buffer.from(awarenessUpdate));
      }

      console.log(`[YjsSync] User ${userId} joined board ${boardId}`);
    });

    socket.on('yjs:update', (boardId: string, update: ArrayBuffer) => {
      const { doc } = getRoom(boardId);
      const uint8Update = new Uint8Array(update);

      // Apply to server's doc to keep it current
      Y.applyUpdate(doc, uint8Update);

      // Broadcast to all other clients in the room
      socket.to(boardId).emit('yjs:update', Buffer.from(uint8Update));
    });

    socket.on('awareness:update', (boardId: string, update: ArrayBuffer) => {
      const { awareness } = getRoom(boardId);
      const uint8Update = new Uint8Array(update);

      // Apply awareness update on the server
      applyAwarenessUpdate(awareness, uint8Update, socket);

      // Broadcast to all other clients in the room
      socket.to(boardId).emit('awareness:update', Buffer.from(uint8Update));
    });

    socket.on('leave-board', (boardId: string) => {
      socket.leave(boardId);
      cleanupAwareness(boardId);
      joinedBoards.delete(boardId);
      console.log(`[YjsSync] User ${userId} left board ${boardId}`);
    });

    socket.on('disconnect', () => {
      // Clean up awareness for all boards this socket was in
      for (const [boardId] of joinedBoards) {
        cleanupAwareness(boardId);
      }
      joinedBoards.clear();
      console.log(`[YjsSync] User ${userId} disconnected (socket ${socket.id})`);
    });

    function cleanupAwareness(boardId: string): void {
      const clientID = joinedBoards.get(boardId);
      if (clientID !== undefined) {
        const { awareness } = getRoom(boardId);
        removeAwarenessStates(awareness, [clientID], socket);
      }
    }
  });
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
