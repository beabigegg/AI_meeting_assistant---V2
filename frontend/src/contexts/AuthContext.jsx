import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

const setAuthToken = token => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete axios.defaults.headers.common['Authorization'];
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            try {
                const decoded = jwtDecode(token);
                const currentTime = Date.now() / 1000;
                if (decoded.exp < currentTime) {
                    console.log("Token expired, logging out.");
                    logout();
                } else {
                    setUser({ id: decoded.sub, role: decoded.role });
                    setAuthToken(token);
                }
            } catch (error) {
                console.error("Invalid token on initial load");
                logout();
            }
        }
        setLoading(false);
    }, [token]);

    const login = async (username, password) => {
        try {
            const response = await axios.post('/api/login', { username, password });
            const { access_token } = response.data;
            localStorage.setItem('token', access_token);
            setToken(access_token);
            const decoded = jwtDecode(access_token);
            setUser({ id: decoded.sub, role: decoded.role });
            setAuthToken(access_token);
            return { success: true };
        } catch (error) {
            console.error('Login failed:', error.response?.data?.msg || error.message);
            return { success: false, message: error.response?.data?.msg || 'Login failed' };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setAuthToken(null);
    };

    const value = {
        user,
        token,
        loading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
