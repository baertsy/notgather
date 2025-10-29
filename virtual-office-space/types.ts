export interface AvatarConfig {
  color: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface User {
  id: string;
  name: string;
  position: Position;
  avatar: AvatarConfig;
}

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bgColor: string;
}

export interface Message {
  id: string;
  senderId: string;
  // receiverId can be a user ID for private, 'everyone' for room, or 'global' for global chat
  receiverId: string; 
  userName: string;
  text: string;
  timestamp: number;
}

export type ChatTarget =
  | { type: 'global' }
  | { type: 'room'; id: string; name: string }
  | { type: 'private'; id: string; name: string };
