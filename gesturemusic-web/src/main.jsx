import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import BackgroundScene from './components/BackgroundScene';
import Navbar from './components/Navbar';
import Learn from './pages/Learn';
import Practice from './pages/Practice';
import Reference from './pages/Reference';
import Calibrate from './pages/Calibrate';
import './styles/tokens.css';
import './styles/glass.css';
import './styles/background.css';
import './styles/app.css';

function App() {
  return <BrowserRouter><BackgroundScene /><div className="app-shell"><Navbar /><Routes><Route path="/" element={<Learn />} /><Route path="/practice" element={<Practice />} /><Route path="/reference" element={<Reference />} /><Route path="/calibrate" element={<Calibrate />} /></Routes><footer className="site-footer"><span>GESTUREMUSIC · LOCAL CAMERA PROCESSING</span><span>Fixed-do in v1 · Hand height not used yet</span><a href="https://commons.wikimedia.org/wiki/Category:Curwen_Hand_Signs" target="_blank" rel="noreferrer">Hand signs: Freya Jarman · CC0 · Wikimedia Commons</a></footer></div></BrowserRouter>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
