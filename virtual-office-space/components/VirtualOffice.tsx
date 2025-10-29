
import React, { useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { MAP_WIDTH, MAP_HEIGHT, PLAYER_SIZE, ROOMS } from '../constants';
import Avatar from './Avatar';
import AvatarCustomizer from './AvatarCustomizer';
import InteractionModal from './InteractionModal';
import { Room, User } from '../types';
import { PhoneOffIcon } from './Icons';

const VirtualOffice: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { user, otherUsers, activeRoomId, isCustomizerOpen, interactionTarget, whisperingTo } = state;
  const mapRef = useRef<HTMLDivElement>(null);

  const movePlayer = useCallback((dx: number, dy: number) => {
    const newX = Math.max(0, Math.min(MAP_WIDTH - PLAYER_SIZE, user.position.x + dx));
    const newY = Math.max(0, Math.min(MAP_HEIGHT - PLAYER_SIZE, user.position.y + dy));
    dispatch({ type: 'SET_USER_POSITION', payload: { x: newX, y: newY } });
  }, [user.position.x, user.position.y, dispatch]);
  
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mapRef.current) {
        const rect = mapRef.current.getBoundingClientRect();
        const scaleX = MAP_WIDTH / rect.width;
        const scaleY = MAP_HEIGHT / rect.height;

        const x = (e.clientX - rect.left) * scaleX - (PLAYER_SIZE / 2);
        const y = (e.clientY - rect.top) * scaleY - (PLAYER_SIZE / 2);
        
        const newX = Math.max(0, Math.min(MAP_WIDTH - PLAYER_SIZE, x));
        const newY = Math.max(0, Math.min(MAP_HEIGHT - PLAYER_SIZE, y));
        dispatch({ type: 'SET_USER_POSITION', payload: { x: newX, y: newY } });
    }
  };
  
  const handleOtherUserClick = (otherUser: User) => {
    dispatch({ type: 'SET_INTERACTION_TARGET', payload: otherUser });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const step = 10;
      switch (e.key) {
        case 'ArrowUp': movePlayer(0, -step); break;
        case 'ArrowDown': movePlayer(0, step); break;
        case 'ArrowLeft': movePlayer(-step, 0); break;
        case 'ArrowRight': movePlayer(step, 0); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePlayer]);

  useEffect(() => {
    const playerCenterX = user.position.x + PLAYER_SIZE / 2;
    const playerCenterY = user.position.y + PLAYER_SIZE / 2;

    const currentRoom = ROOMS.find(room =>
      playerCenterX >= room.x &&
      playerCenterX <= room.x + room.width &&
      playerCenterY >= room.y &&
      playerCenterY <= room.y + room.height
    );

    if (currentRoom && activeRoomId !== currentRoom.id) {
      dispatch({ type: 'SET_ACTIVE_ROOM', payload: currentRoom.id });
    } else if (!currentRoom && activeRoomId) {
      dispatch({ type: 'SET_ACTIVE_ROOM', payload: null });
    }
  }, [user.position, activeRoomId, dispatch]);

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div 
        className="relative bg-gray-800 border-2 border-gray-600 w-full h-full"
        style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`, maxWidth: `${MAP_WIDTH}px`, maxHeight: `${MAP_HEIGHT}px` }}
      >
        <div 
          ref={mapRef} 
          className="absolute inset-0 cursor-pointer" 
          style={{ width: '100%', height: '100%' }}
          onClick={handleMapClick}
        >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_500px_at_50%_200px,#3e3e3e,transparent)]"></div>
            <div className="absolute text-center w-full top-4 text-gray-400 font-bold text-lg pointer-events-none">Open Space</div>

            {ROOMS.map((room: Room) => (
            <div
                key={room.id}
                className="absolute border-2 border-dashed border-gray-500 flex items-center justify-center pointer-events-none"
                style={{
                    left: `${(room.x / MAP_WIDTH) * 100}%`,
                    top: `${(room.y / MAP_HEIGHT) * 100}%`,
                    width: `${(room.width / MAP_WIDTH) * 100}%`,
                    height: `${(room.height / MAP_HEIGHT) * 100}%`,
                    backgroundColor: room.bgColor,
                }}
            >
                <span className="text-white font-semibold text-xl p-2 bg-black bg-opacity-50 rounded">{room.name}</span>
            </div>
            ))}

            {otherUsers.map(otherUser => (
                <div key={otherUser.id} onClick={(e) => { e.stopPropagation(); handleOtherUserClick(otherUser); }}>
                    <Avatar user={otherUser} isYou={false} />
                </div>
            ))}
            <Avatar user={user} isYou={true} />
        </div>
      </div>
      
      {isCustomizerOpen && <AvatarCustomizer />}
      {interactionTarget && <InteractionModal targetUser={interactionTarget} />}

      {whisperingTo && (
        <div className="absolute bottom-20 left-4 z-20">
            <button onClick={() => dispatch({type: 'END_WHISPER'})} className="flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-lg">
                <PhoneOffIcon className="w-5 h-5 mr-2" />
                End Whisper
            </button>
        </div>
      )}
    </div>
  );
};

export default VirtualOffice;