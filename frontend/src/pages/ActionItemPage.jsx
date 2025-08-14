import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Paper, CircularProgress, Alert,
    TextField, Button, Select, MenuItem, FormControl, InputLabel, Grid, Link
} from '@mui/material';
import { getActionItemDetails, updateActionItem, uploadAttachment } from '../services/api';

const ActionItemPage = () => {
    const { actionId } = useParams();
    const navigate = useNavigate();
    const [actionItem, setActionItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [attachment, setAttachment] = useState(null);

    useEffect(() => {
        const fetchActionItem = async () => {
            setLoading(true);
            try {
                const data = await getActionItemDetails(actionId);
                setActionItem(data);
            } catch (err) {
                setError(err.message || 'Could not fetch action item details.');
            } finally {
                setLoading(false);
            }
        };
        fetchActionItem();
    }, [actionId]);

    const handleUpdate = async () => {
        if (!actionItem) return;
        setLoading(true);
        try {
            // Only send fields that are meant to be updated
            const updateData = {
                item: actionItem.item,
                action: actionItem.action,
                status: actionItem.status,
                due_date: actionItem.due_date,
                // owner_id is typically not changed from this screen, but could be added if needed
            };
            await updateActionItem(actionId, updateData);
            
            if (attachment) {
                // Note: The backend needs an endpoint to handle attachment uploads for an action item.
                // This is a placeholder for that functionality.
                // await uploadAttachment(actionId, attachment);
                console.warn("Attachment upload functionality is not yet implemented on the backend.");
            }

            setIsEditing(false);
            // Refresh data after update
            const data = await getActionItemDetails(actionId);
            setActionItem(data);

        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update action item.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (event) => {
        setAttachment(event.target.files[0]);
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!actionItem) return <Alert severity="info">No action item found.</Alert>;

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Action Item for: {actionItem.meeting?.topic || 'General Task'}
            </Typography>
            <Paper sx={{ p: 3 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            label="Context/Item"
                            fullWidth
                            multiline
                            rows={2}
                            value={actionItem.item || ''}
                            onChange={(e) => setActionItem({ ...actionItem, item: e.target.value })}
                            InputProps={{ readOnly: !isEditing }}
                            variant={isEditing ? "outlined" : "filled"}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label="Action"
                            fullWidth
                            multiline
                            rows={4}
                            value={actionItem.action || ''}
                            onChange={(e) => setActionItem({ ...actionItem, action: e.target.value })}
                            InputProps={{ readOnly: !isEditing }}
                            variant={isEditing ? "outlined" : "filled"}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth variant={isEditing ? "outlined" : "filled"}>
                            <InputLabel>Status</InputLabel>
                            <Select
                                label="Status"
                                value={actionItem.status || 'pending'}
                                onChange={(e) => setActionItem({ ...actionItem, status: e.target.value })}
                                readOnly={!isEditing}
                            >
                                <MenuItem value="pending">Pending</MenuItem>
                                <MenuItem value="in_progress">In Progress</MenuItem>
                                <MenuItem value="completed">Completed</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Due Date"
                            type="date"
                            fullWidth
                            value={actionItem.due_date || ''}
                            onChange={(e) => setActionItem({ ...actionItem, due_date: e.target.value })}
                            InputProps={{ readOnly: !isEditing }}
                            variant={isEditing ? "outlined" : "filled"}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Typography>Owner: {actionItem.owner?.username || 'N/A'}</Typography>
                        {actionItem.attachment_path && (
                            <Typography>
                                Attachment: <Link href={`/api/download/${actionItem.attachment_path.split('/').pop()}`} target="_blank" rel="noopener">Download</Link>
                            </Typography>
                        )}
                    </Grid>
                    {isEditing && (
                        <Grid item xs={12}>
                            <Button
                                variant="contained"
                                component="label"
                            >
                                Upload Attachment
                                <input
                                    type="file"
                                    hidden
                                    onChange={handleFileChange}
                                />
                            </Button>
                            {attachment && <Typography sx={{ display: 'inline', ml: 2 }}>{attachment.name}</Typography>}
                        </Grid>
                    )}
                    <Grid item xs={12} sx={{ mt: 2 }}>
                        {isEditing ? (
                            <Box>
                                <Button onClick={handleUpdate} variant="contained" color="primary" disabled={loading}>
                                    {loading ? <CircularProgress size={24} /> : 'Save Changes'}
                                </Button>
                                <Button onClick={() => setIsEditing(false)} sx={{ ml: 2 }}>Cancel</Button>
                            </Box>
                        ) : (
                            <Button onClick={() => setIsEditing(true)} variant="contained">Edit</Button>
                        )}
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default ActionItemPage;