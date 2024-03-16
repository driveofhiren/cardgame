import React from 'react';
import './App.css';

import { Deck } from './Components/Deck'; // Import Card as a named export

function App() {
  return (
    <div className="App">
      <Deck /> {/* Render Card component */}
    </div>
  );
}

export default App;
