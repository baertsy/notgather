import React, { useState } from "react";
import { AppProvider, useAppContext } from "./context/AppContext";
import VirtualOffice from "./components/VirtualOffice";
import { ToastContainer } from "react-toastify";
import VideoCallUI from "./components/VideoCallUI";
import WhisperCallUI from "./components/WhisperCallUI";
import ControlBar from "./components/ControlBar";
import UnifiedChat from "./components/UnifiedChat";
import Login from "./components/Login";
import Register from "./components/Register";

const AppContent: React.FC = () => {
  const { user, room, logout, joinRoom, rooms } = useAppContext();
  const [showRegister, setShowRegister] = useState(false);

  if (!user) {
    return showRegister
      ? <Register onRegister={() => setShowRegister(false)} />
      : <div>
          <Login onLogin={() => {}} />
          <div className="text-center mt-4">
            <button className="underline text-blue-400" onClick={() => setShowRegister(true)}>
              Nincs fiókod? Regisztrálj!
            </button>
          </div>
        </div>;
  }

  return (
    <div className="w-full h-full overflow-hidden flex flex-col font-sans bg-gray-800 relative">
      <header className="flex items-center justify-between p-2 bg-gray-900">
        <span className="font-bold">Üdv, {user.username}!</span>
        <button className="text-sm bg-red-800 rounded px-2 py-1" onClick={logout}>Kijelentkezés</button>
      </header>
      {!room ? (
        <main className="flex-1 flex flex-col items-center justify-center">
          <h2 className="text-xl font-bold mb-4">Szobák</h2>
          <ul>
            {rooms.map((r: any) =>
              <li key={r.id} className="flex gap-2 items-center mb-2">
                <span>{r.name}</span>
                <button className="bg-blue-600 px-2 py-1 rounded text-white" onClick={() => joinRoom(r.id)}>Belépés</button>
              </li>
            )}
          </ul>
        </main>
      ) : (
        <VideoCallUI room={room} />
      )}

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

const App: React.FC = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;
