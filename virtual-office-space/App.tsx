
import React from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import VirtualOffice from './components/VirtualOffice';
import { ToastContainer } from 'react-toastify';
import VideoCallUI from './components/VideoCallUI';
import WhisperCallUI from './components/WhisperCallUI';
import ControlBar from './components/ControlBar';
import { ROOMS } from './constants';
import UnifiedChat from './components/UnifiedChat';

const AppContent: React.FC = () => {
  const { state } = useAppContext();
  const activeRoom = ROOMS.find(r => r.id === state.activeRoomId);
  const whisperTargetUser = state.otherUsers.find(u => u.id === state.whisperingTo);

  return (
    <div className="w-full h-full overflow-hidden flex flex-col font-sans bg-gray-800 relative">
      {whisperTargetUser ? (
        <WhisperCallUI targetUser={whisperTargetUser} />
      ) : activeRoom ? (
        <VideoCallUI room={activeRoom} />
      ) : null}

      <main className="flex-1 relative bg-gray-700 min-h-0">
        <VirtualOffice />
      </main>
      <ControlBar />
      
      {state.isChatOpen && <UnifiedChat />}

      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );
};


const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;