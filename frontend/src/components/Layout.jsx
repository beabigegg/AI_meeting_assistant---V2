import React from 'react';
import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}>
                        AI Meeting Assistant
                    </Typography>
                    {user && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Button color="inherit" component={Link} to="/">
                                Dashboard
                            </Button>
                            <Button color="inherit" component={Link} to="/processing">
                                Processing Tools
                            </Button>
                            <Typography sx={{ mx: 2 }}>
                                | Welcome, {user.id} ({user.role})
                            </Typography>
                            <Button color="inherit" onClick={handleLogout}>
                                Logout
                            </Button>
                        </Box>
                    )}
                </Toolbar>
            </AppBar>
            <Container component="main" maxWidth={false} sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
                {children}
            </Container>
        </Box>
    );
};

export default Layout;
