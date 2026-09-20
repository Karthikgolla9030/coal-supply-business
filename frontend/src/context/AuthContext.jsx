import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we have a token stored
    const checkAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        try {
          const response = await client.get('/auth/me/');
          setUser(response.data);
        } catch (error) {
          // If the token is invalid/expired, the interceptor handles logout/refresh
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    const cleanUsername = typeof username === 'string' ? username.trim() : username;
    const response = await client.post('/auth/login/', { username: cleanUsername, password });
    const { access, refresh } = response.data;
    
    // Store tokens
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    
    // Fetch user info
    const userResponse = await client.get('/auth/me/');
    setUser(userResponse.data);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
