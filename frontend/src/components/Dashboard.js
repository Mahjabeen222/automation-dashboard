import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const [hoveredCard, setHoveredCard] = useState(null);
  const navigate = useNavigate();

  const automationModules = [
    {
      id: 1,
      title: 'Social Media Automation',
      description: 'Intelligent content scheduling and engagement automation across all social platforms',
      path: '/facebook',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
          <circle cx="7" cy="8" r="1"/>
          <circle cx="12" cy="8" r="1"/>
          <circle cx="17" cy="8" r="1"/>
          <path d="M5 11h14"/>
        </svg>
      ),
    },
    {
      id: 2,
      title: 'Instagram Automation',
      description: 'Intelligent content scheduling and engagement automation across all social platforms',
      path: '/instagram',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
          <circle cx="7" cy="8" r="1"/>
          <circle cx="12" cy="8" r="1"/>
          <circle cx="17" cy="8" r="1"/>
          <path d="M5 11h14"/>
        </svg>
      ),
    },
    {
      id: 3,
      title: 'Email Automation',
      description: 'Advanced email sequences with behavioral triggers and personalization engines',
      path: '/email',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
    },
    {
      id: 4,
      title: 'Campaign Automation',
      description: 'AI-driven advertising optimization with real-time bidding and performance analytics',
      path: '/ads',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    }
  ];

  const handleModuleClick = (path) => {
    navigate(path);
  };

  return (
    <main className="dashboard-main">
      <div className="automation-suite">
        {automationModules.map((module) => (
          <div
            key={module.id}
            className={`automation-module ${hoveredCard === module.id ? 'active' : ''}`}
            onMouseEnter={() => setHoveredCard(module.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="module-icon">{module.icon}</div>
            
            <div className="module-content">
              <h3 className="module-title">{module.title}</h3>
              <p className="module-description">{module.description}</p>
            </div>

            <div className="module-action">
              <button 
                className="access-btn"
                onClick={() => handleModuleClick(module.path)}
              >
                <span>Launch Module</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9,18 15,12 9,6"></polyline>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default Dashboard; 