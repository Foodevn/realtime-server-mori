import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

interface Room {
  doc: Y.Doc;
  awareness: Awareness;
}

const rooms = new Map<string, Room>();

export function getRoom(boardId: string): Room {
  let room = rooms.get(boardId);
  if (!room) {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    room = { doc, awareness };
    rooms.set(boardId, room);
  }
  return room;
}
