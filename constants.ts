import { Room } from './types';

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 800;
export const PLAYER_SIZE = 32;

export const ROOMS: Room[] = [
  { id: 'room1', name: 'Working area', x: 50, y: 50, width: 450, height: 300, bgColor: 'rgba(52, 211, 153, 0.3)' },
  { id: 'room2', name: 'Call center', x: MAP_WIDTH - 500, y: 50, width: 450, height: 300, bgColor: 'rgba(96, 165, 250, 0.3)' },
  { id: 'room3', name: 'Random room', x: 50, y: MAP_HEIGHT - 350, width: 450, height: 300, bgColor: 'rgba(251, 146, 60, 0.3)' },
];
