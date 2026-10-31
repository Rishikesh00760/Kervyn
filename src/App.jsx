import { useState } from 'react';
import './App.css';

import AboutPopup from './components/aboutPopup/aboutPopup';
import Datasheet from './components/datasheet/Datasheet';
import AIBox from './components/aibox/AIBox';

function App() {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <div className="container">
      <header className="navbar">
        <span className="title">Kervyn - Dashboard</span>

        <button
          type="button"
          className="about-btn"
          onClick={() => setShowAbout(true)}
          aria-label="About Kervyn"
          title="About Kervyn"
        >
          ⓘ
        </button>
      </header>

      <AboutPopup
        isOpen={showAbout}
        onClose={() => setShowAbout(false)}
      />

      <main className="work-table">
        <Datasheet />
        <AIBox />
      </main>
    </div>
  );
}

export default App;