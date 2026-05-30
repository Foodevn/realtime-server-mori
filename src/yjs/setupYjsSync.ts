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

    // Track clientIDs used by this socket across different boards
    // Map<boardId, Set<clientID>>
    const socketClientIds = new Map<string, Set<number>>();

    socket.on('join-board', (boardId: string) => {
      const { doc, awareness } = getRoom(boardId);

      socket.join(boardId);

      // Initialize tracking for this board
      if (!socketClientIds.has(boardId)) {
        socketClientIds.set(boardId, new Set());
      }

      // Listen for awareness updates to capture the clientID(s) used by this socket
      const awarenessUpdateHandler = (
        { added, updated }: { added: number[]; updated: number[] },
        origin: any
      ) => {
        if (origin === socket) {
          const ids = socketClientIds.get(boardId);
          if (ids) {
            added.forEach(id => ids.add(id));
            updated.forEach(id => ids.add(id));
          }
        }
      };

      awareness.on('update', awarenessUpdateHandler);

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

      // Store handler for cleanup when leaving board or disconnecting
      socket.data[`awarenessHandler_${boardId}`] = awarenessUpdateHandler;
    });

    socket.on('yjs:update', (boardId: string, update: ArrayBuffer) => {
      const { doc } = getRoom(boardId);
      const uint8Update = new Uint8Array(update);
      Y.applyUpdate(doc, uint8Update);
      socket.to(boardId).emit('yjs:update', Buffer.from(uint8Update));
    });

    socket.on('awareness:update', (boardId: string, update: ArrayBuffer) => {
      const { awareness } = getRoom(boardId);
      const uint8Update = new Uint8Array(update);
      // Pass socket as origin to track which IDs it's updating
      applyAwarenessUpdate(awareness, uint8Update, socket);
      socket.to(boardId).emit('awareness:update', Buffer.from(uint8Update));
    });

    socket.on('leave-board', (boardId: string) => {
      socket.leave(boardId);
      cleanupAwareness(boardId);
      console.log(`[YjsSync] User ${userId} left board ${boardId}`);
    });

    socket.on('disconnect', () => {
      for (const boardId of socketClientIds.keys()) {
        cleanupAwareness(boardId);
      }
      console.log(`[YjsSync] User ${userId} disconnected (socket ${socket.id})`);
    });

    function cleanupAwareness(boardId: string): void {
      const ids = socketClientIds.get(boardId);
      const { awareness } = getRoom(boardId);
      
      // Stop listening to updates for this board
      const handler = socket.data[`awarenessHandler_${boardId}`];
      if (handler) {
        awareness.off('update', handler);
        delete socket.data[`awarenessHandler_${boardId}`];
      }

      if (ids && ids.size > 0) {
        removeAwarenessStates(awareness, Array.from(ids), socket);
        ids.clear();
      }
      socketClientIds.delete(boardId);
    }
  });
}
