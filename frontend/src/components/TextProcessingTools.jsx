import React, { useState, useEffect } from 'react';
import {
    Box, Button, Typography, Paper, TextField, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { getMeetings, createMeeting, batchCreateActionItems } from '../services/api'; // Only necessary APIs

const TextProcessingTools = ({ 
    textContent, 
    summary, 
    actionItems, 
    onGenerateSummary, 
    onPreviewActions, 
    onActionItemChange 
}) => {
    const [meetings, setMeetings] = useState([]);
    const [users, setUsers] = useState([]); // Assuming users are needed for dropdown
    const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
    const [associationType, setAssociationType] = useState('existing');
    const [selectedMeetingId, setSelectedMeetingId] = useState('');
    const [newMeetingTopic, setNewMeetingTopic] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDropdownData = async () => {
            try {
                const meetingsRes = await getMeetings();
                setMeetings(meetingsRes.data);
                if (meetingsRes.data.length > 0) {
                    setSelectedMeetingId(meetingsRes.data[0].id);
                }
            } catch (err) { console.error('Could not fetch meetings for dropdown.'); }
        };
        fetchDropdownData();
    }, []);

    const handleInitiateSave = () => {
        if (!actionItems || !Array.isArray(actionItems) || actionItems.length === 0) {
            setError('No valid action items to save.');
            return;
        }
        setError('');
        setIsMeetingDialogOpen(true);
    };

    const handleConfirmSave = async () => {
        let meetingIdToSave = selectedMeetingId;
        if (associationType === 'new') {
            if (!newMeetingTopic) { setError('New meeting topic is required.'); return; }
            try {
                const { data: newMeeting } = await createMeeting(newMeetingTopic, new Date().toISOString());
                meetingIdToSave = newMeeting.id;
            } catch (err) { setError('Failed to create new meeting.'); return; }
        }

        if (!meetingIdToSave) { setError('A meeting must be selected or created.'); return; }

        setSaveLoading(true); setError('');
        try {
            const itemsToSave = actionItems.map(({ tempId, owner, duedate, ...rest }) => rest);
            await batchCreateActionItems(meetingIdToSave, itemsToSave);
            setIsMeetingDialogOpen(false);
            alert('Action Items saved successfully!');
            // Optionally, clear items after save by calling a prop function from parent
        } catch (err) { setError(err.response?.data?.error || 'Failed to save action items.'); }
        finally { setSaveLoading(false); }
    };

    return (
        <Box sx={{ mt: 1 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box sx={{display: 'flex', gap: 2, mb: 2}}>
                <Button onClick={onGenerateSummary} disabled={!textContent} variant="outlined">Generate Summary</Button>
                <Button onClick={onPreviewActions} disabled={!textContent} variant="outlined">Generate Action Items</Button>
            </Box>

            {summary && <Paper elevation={2} sx={{ p: 2, mb: 2 }}><Typography variant="h6">Summary</Typography><TextField fullWidth multiline rows={6} value={summary} variant="outlined" sx={{mt:1}}/></Paper>}
            
            {actionItems && actionItems.length > 0 && (
                <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="h6">Review and Edit Action Items</Typography>
                    <TableContainer component={Paper} sx={{ mt: 2 }}>
                        <Table size="small">
                            <TableHead><TableRow><TableCell>Context</TableCell><TableCell>Action</TableCell><TableCell>Owner</TableCell><TableCell>Due Date</TableCell></TableRow></TableHead>
                            <TableBody>{actionItems.map(item => (
                                <TableRow key={item.tempId}>
                                    <TableCell><TextField variant="standard" fullWidth value={item.item || ''} onChange={e => onActionItemChange(item.tempId, 'item', e.target.value)}/></TableCell>
                                    <TableCell><TextField variant="standard" fullWidth value={item.action || ''} onChange={e => onActionItemChange(item.tempId, 'action', e.target.value)}/></TableCell>
                                    <TableCell><TextField variant="standard" fullWidth value={item.owner || ''} onChange={e => onActionItemChange(item.tempId, 'owner', e.target.value)}/></TableCell>
                                    <TableCell><TextField variant="standard" type="date" fullWidth value={item.due_date || ''} onChange={e => onActionItemChange(item.tempId, 'due_date', e.target.value)} InputLabelProps={{ shrink: true }}/></TableCell>
                                </TableRow>
                            ))}</TableBody>
                        </Table>
                    </TableContainer>
                    <Box mt={2} display="flex" justifyContent="flex-end">
                        <Button onClick={handleInitiateSave} disabled={saveLoading} variant="contained" color="primary">Save All Action Items</Button>
                    </Box>
                </Paper>
            )}

            <Dialog open={isMeetingDialogOpen} onClose={() => setIsMeetingDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Associate with a Meeting</DialogTitle>
                <DialogContent>
                    <FormControl component="fieldset" sx={{mt:1}}><Select size="small" value={associationType} onChange={e => setAssociationType(e.target.value)}><MenuItem value="existing">Existing Meeting</MenuItem><MenuItem value="new">New Meeting</MenuItem></Select></FormControl>
                    {associationType === 'existing' ? <FormControl fullWidth sx={{mt:2}}><InputLabel>Select Meeting</InputLabel><Select value={selectedMeetingId} label="Select Meeting" onChange={e => setSelectedMeetingId(e.target.value)}>{meetings.map(m => <MenuItem key={m.id} value={m.id}>{m.topic}</MenuItem>)}</Select></FormControl> : <TextField label="New Meeting Topic" fullWidth sx={{mt:2}} value={newMeetingTopic} onChange={e => setNewMeetingTopic(e.target.value)} />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsMeetingDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmSave} variant="contained" disabled={saveLoading}>{saveLoading ? <CircularProgress size={24}/> : 'Confirm & Save'}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default TextProcessingTools;
