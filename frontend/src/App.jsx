import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProcessingPage from './pages/ProcessingPage';
import MeetingDetailPage from './pages/MeetingDetailPage'; // Import the new, correct page
// import AdminPage from './pages/AdminPage'; // Temporarily commented out as it does not exist yet
import Layout from './components/Layout';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const PrivateRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  return user ? <Layout><Outlet /></Layout> : <Navigate to="/login" />;
};

const AdminRoute = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
    }

    // Ensure user object and role property exist before checking
    return user && user.role === 'admin' ? <Outlet /> : <Navigate to="/" />;
};

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute />}>
          <Route index element={<DashboardPage />} />
          <Route path="processing" element={<ProcessingPage />} />
          {/* The new, correct route for viewing and managing a meeting's action items */}
          <Route path="meeting/:meetingId" element={<MeetingDetailPage />} />
          
          {/* The old route to ActionItemPage is removed as it's replaced by MeetingDetailPage */}
          {/* <Route path="action-item/:actionId" element={<ActionItemPage />} /> */}

          {/* Temporarily disable the admin route until the page is created */}
          {/* <Route path="admin" element={<AdminRoute />}>
              <Route index element={<AdminPage />} />
          </Route> */}
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

export default App;
