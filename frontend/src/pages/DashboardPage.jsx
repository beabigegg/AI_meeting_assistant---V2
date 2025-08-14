import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
    Typography, Box, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, CircularProgress, 
    Alert, Button
} from '@mui/material';
// Correctly import only the existing API function
import { getMeetings } from '../services/api';

const DashboardPage = () => {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Fetch only the meetings data, which is available
                const { data } = await getMeetings();
                setMeetings(data);
            } catch (err) {
                setError(err.response?.data?.msg || err.message || 'Could not fetch dashboard data.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <CircularProgress />;
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box>
            {/* The "My Action Items" section has been removed as its API endpoint does not exist. */}
            {/* This can be implemented as a future enhancement when a corresponding backend API is available. */}

            <Typography variant="h4" gutterBottom>
                All Meetings
            </Typography>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="meetings table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Topic</TableCell>
                            <TableCell align="right">Date</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {meetings.map((meeting) => (
                            <TableRow
                                key={meeting.id}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                            >
                                <TableCell component="th" scope="row">
                                    {meeting.topic}
                                </TableCell>
                                <TableCell align="right">{new Date(meeting.meeting_date).toLocaleString()}</TableCell>
                                <TableCell align="center">
                                    {/* This button now correctly links to the functional MeetingDetailPage */}
                                    <Button
                                        component={RouterLink}
                                        to={`/meeting/${meeting.id}`}
                                        variant="outlined"
                                        size="small"
                                    >
                                        View Details
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default DashboardPage;
