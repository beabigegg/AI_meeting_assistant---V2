import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    Box, Typography, Paper, CircularProgress, Alert, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Select, MenuItem, FormControl, InputLabel, Tooltip
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { getMeetingDetails, getActionItemsForMeeting, createActionItem, updateActionItem, deleteActionItem, getUsers } from '../services/api';

// This should be replaced by a real Auth Context
const MOCK_USER = { id: '1', role: 'admin' }; // Simulating an admin user

const MeetingDetailPage = () => {
    const { meetingId } = useParams();
    const [meeting, setMeeting] = useState(null);
    const [actionItems, setActionItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState({ page: true, users: true });
    const [error, setError] = useState({ meeting: '', items: '', users: '' });
    const [editingId, setEditingId] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newActionItem, setNewActionItem] = useState({ action: '', owner_id: '', due_date: '', item: '' });

    const currentUser = MOCK_USER;

    const fetchData = useCallback(async () => {
        setLoading(prev => ({ ...prev, page: true }));

        // Fetch critical data in separate blocks for resilience
        try {
            const meetingRes = await getMeetingDetails(meetingId);
            setMeeting(meetingRes.data);
        } catch (err) {
            setError(prev => ({ ...prev, meeting: 'Failed to fetch meeting details.' }));
        }

        try {
            const itemsRes = await getActionItemsForMeeting(meetingId);
            setActionItems(itemsRes.data);
        } catch (err) {
            setError(prev => ({ ...prev, items: 'Failed to fetch action items.' }));
        }
        
        setLoading(prev => ({ ...prev, page: false }));

        // Attempt to fetch non-critical user list
        try {
            const usersRes = await getUsers();
            setUsers(usersRes.data);
        } catch (userError) {
            console.warn('Could not fetch full user list:', userError);
            setError(prev => ({ ...prev, users: 'Could not fetch full user list for dropdowns.' }));
        }
        setLoading(prev => ({ ...prev, users: false }));

    }, [meetingId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEditClick = (item) => {
        setEditingId(item.id);
        setEditFormData({ ...item });
    };

    const handleCancelClick = () => setEditingId(null);

    const handleSaveClick = async (id) => {
        try {
            await updateActionItem(id, editFormData);
            setEditingId(null);
            fetchData(); // Force refetch
        } catch (err) { setError({ general: 'Failed to save changes.' }); }
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm('Are you sure?')) {
            try {
                await deleteActionItem(id);
                fetchData(); // Force refetch
            } catch (err) { setError({ general: 'Failed to delete item.' }); }
        }
    };

    const handleAddDialogSave = async () => {
        if (!newActionItem.action) { setError({ general: 'Action is required.' }); return; }
        try {
            await createActionItem({ ...newActionItem, meeting_id: meetingId });
            setIsAddDialogOpen(false);
            setNewActionItem({ action: '', owner_id: '', due_date: '', item: '' });
            fetchData(); // Force refetch
        } catch (err) { setError({ general: 'Failed to create new action item.' }); }
    };

    if (loading.page) return <CircularProgress />;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" gutterBottom component="div">
                    Action Items for: <span style={{ color: '#bb86fc' }}>{meeting?.topic || '...'}</span>
                </Typography>
                <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => setIsAddDialogOpen(true)}>Add Action Item</Button>
            </Box>
            {error.meeting && <Alert severity="error">{error.meeting}</Alert>}
            {error.items && <Alert severity="error">{error.items}</Alert>}
            {error.general && <Alert severity="error">{error.general}</Alert>}
            
            <TableContainer component={Paper}>
                <Table>
                    <TableHead><TableRow><Tooltip title="Original discussion point"><TableCell>Context/Item</TableCell></Tooltip><TableCell>Action</TableCell><TableCell>Owner</TableCell><TableCell>Due Date</TableCell><TableCell>Status</TableCell><TableCell align="center">Actions</TableCell></TableRow></TableHead>
                    <TableBody>
                        {actionItems.map((item) => {
                            const isEditing = editingId === item.id;
                            const canEdit = currentUser.role === 'admin' || String(currentUser.id) === String(item.owner_id);
                            return (
                                <TableRow key={item.id}>
                                    <TableCell sx={{ backgroundColor: '#333', color: '#bbb', fontSize: '0.8rem' }}>{item.item}</TableCell>
                                    <TableCell>{isEditing ? <TextField name="action" defaultValue={item.action} onChange={e => setEditFormData({...editFormData, action: e.target.value})} fullWidth /> : item.action}</TableCell>
                                    <TableCell>{isEditing ? <Select name="owner_id" defaultValue={item.owner_id} onChange={e => setEditFormData({...editFormData, owner_id: e.target.value})} fullWidth>{users.map(u => <MenuItem key={u.id} value={u.id}>{u.username}</MenuItem>)}</Select> : item.owner_name}</TableCell>
                                    <TableCell>{isEditing ? <TextField name="due_date" type="date" defaultValue={item.due_date || ''} onChange={e => setEditFormData({...editFormData, due_date: e.target.value})} InputLabelProps={{ shrink: true }} fullWidth /> : item.due_date}</TableCell>
                                    <TableCell>{isEditing ? <Select name="status" defaultValue={item.status} onChange={e => setEditFormData({...editFormData, status: e.target.value})} fullWidth><MenuItem value="pending">Pending</MenuItem><MenuItem value="in_progress">In Progress</MenuItem><MenuItem value="completed">Completed</MenuItem></Select> : item.status}</TableCell>
                                    <TableCell align="center">
                                        {isEditing ? <Box><IconButton onClick={() => handleSaveClick(item.id)}><SaveIcon /></IconButton><IconButton onClick={handleCancelClick}><CancelIcon /></IconButton></Box> : <Box>{canEdit && <IconButton onClick={() => handleEditClick(item)}><EditIcon /></IconButton>}{canEdit && <IconButton onClick={() => handleDeleteClick(item.id)}><DeleteIcon /></IconButton>}</Box>}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add New Action Item</DialogTitle>
                <DialogContent>
                    <TextField label="Context/Item (Optional)" fullWidth margin="dense" onChange={e => setNewActionItem({...newActionItem, item: e.target.value})} />
                    <TextField label="Action (Required)" fullWidth margin="dense" required onChange={e => setNewActionItem({...newActionItem, action: e.target.value})} />
                    <FormControl fullWidth margin="dense"><InputLabel>Owner</InputLabel><Select label="Owner" onChange={e => setNewActionItem({...newActionItem, owner_id: e.target.value})}>{users.map(u => <MenuItem key={u.id} value={u.id}>{u.username}</MenuItem>)}</Select></FormControl>
                    <TextField label="Due Date" type="date" fullWidth margin="dense" InputLabelProps={{ shrink: true }} onChange={e => setNewActionItem({...newActionItem, due_date: e.target.value})} />
                </DialogContent>
                <DialogActions><Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button><Button onClick={handleAddDialogSave} variant="contained">Save</Button></DialogActions>
            </Dialog>
        </Box>
    );
};

export default MeetingDetailPage;
