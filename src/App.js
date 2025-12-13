import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setIsLoaded(true);
    }, 500);
  }, []);

  return (
    <div className="App">
      <header className="header">
        <div className="container">
          <h1>The Vibe Coders Show</h1>
          <p>Coding with rhythm, passion, and innovation</p>
        </div>
      </header>
      
      <main className="main-content">
        <section className="hero">
          <div className="container">
            <div className={`content ${isLoaded ? 'loaded' : ''}`}>
              <h2>Welcome to the vibe</h2>
              <p>We're passionate about building amazing digital experiences with code.</p>
              <button className="cta-button">Join the vibe</button>
            </div>
          </div>
        </section>
        
        <section className="features">
          <div className="container">
            <div className="feature-grid">
              <div className="feature-card">
                <h3>Live Coding Sessions</h3>
                <p>Watch us code in real-time, solving complex problems and sharing our thought processes.</p>
              </div>
              <div className="feature-card">
                <h3>Collaborative Projects</h3>
                <p>Join our community to contribute to exciting open-source projects.</p>
              </div>
              <div className="feature-card">
                <h3>Tutorials & Workshops</h3>
                <p>Learn the latest technologies and best practices through our structured learning paths.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="footer">
        <div className="container">
          <p>&copy; 2025 The Vibe Coders Show. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;