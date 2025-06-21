import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import SocialMediaPage from './components/SocialMediaPage';
import EmailPage from './components/EmailPage';
import AdsPage from './components/AdsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Layout>
            <Dashboard />
          </Layout>
        } />
        <Route path="/social-media" element={<SocialMediaPage />} />
        <Route path="/email" element={<EmailPage />} />
        <Route path="/ads" element={<AdsPage />} />
      </Routes>
    </Router>
  );
}

export default App;