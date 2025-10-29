import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { CloseIcon } from './Icons';
import Avatar from './Avatar';

const AvatarCustomizer: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { user } = state;
  const [name, setName] = useState(user.name);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_AVATAR', payload: { ...user.avatar, color: e.target.value } });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };
  
  const handleSaveName = () => {
    if(name.trim()) {
        dispatch({ type: 'SET_USER_NAME', payload: name.trim() });
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md relative border border-gray-700">
        <button onClick={() => dispatch({ type: 'TOGGLE_CUSTOMIZER' })} className="absolute top-3 right-3 text-gray-400 hover:text-white">
          <CloseIcon className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center">Customize Your Avatar</h2>

        <div className="flex justify-center items-center mb-6">
            <div className="w-24 h-24 relative flex items-center justify-center">
                 <Avatar user={{...user, position: {x: 0, y: 0}}} isYou={false} />
            </div>
        </div>

        <div className="mb-6">
            <h3 className="font-semibold mb-2">Name</h3>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={name} 
                    onChange={handleNameChange}
                    onBlur={handleSaveName}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>

        <div className="mb-6">
          <label htmlFor="avatarColor" className="font-semibold mb-2 block">Color</label>
          <div className="flex items-center gap-4">
            <input
                id="avatarColor"
                type="color"
                value={user.avatar.color}
                onChange={handleColorChange}
                className="w-14 h-14 p-1 bg-gray-700 border border-gray-600 rounded-md cursor-pointer"
             />
             <span className="text-lg font-mono p-2 rounded-md bg-gray-700 border border-gray-600">{user.avatar.color.toUpperCase()}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AvatarCustomizer;
