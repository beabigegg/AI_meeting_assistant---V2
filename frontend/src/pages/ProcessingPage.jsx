import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert, Grid, Card, CardContent, CardActions, Chip, LinearProgress
} from '@mui/material';
import TextProcessingTools from '../components/TextProcessingTools';
import { 
    extractAudio, 
    transcribeAudio, 
    translateTextFile, 
    summarizeText, 
    previewActionItems, 
    pollTaskStatus, 
    stopTask, 
    getFileContent
} from '../services/api';

// A dedicated, robust component for monitoring any task
const TaskMonitor = ({ task, onStop, translationPreview }) => {
    if (!task) return null;
    const colorMap = { PENDING: 'default', PROGRESS: 'info', SUCCESS: 'success', FAILURE: 'error', REVOKED: 'warning' };
    const progress = task.info?.total ? (task.info.current / task.info.total * 100) : null;

    return (
        <Paper sx={{ p: 2, mt: 1, border: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip label={task.state} color={colorMap[task.state] || 'default'} size="small" />
                {(task.state === 'PENDING' || task.state === 'PROGRESS') && 
                    <Button size="small" color="error" variant="text" onClick={() => onStop(task.task_id)}>Stop</Button>}
            </Box>
            {task.info?.status_msg && <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>{task.info.status_msg}</Typography>}
            {progress !== null && <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />}
            {translationPreview && <Paper sx={{p:1, mt:1, maxHeight: 150, overflow: 'auto', bgcolor: '#222'}}><Typography variant="caption" sx={{whiteSpace: 'pre-wrap'}}>{translationPreview}</Typography></Paper>}
            {task.state === 'SUCCESS' && task.info?.download_filename && <Button size="small" sx={{mt:1}} href={`/api/download/${task.info.download_filename}`} target="_blank">Download Result</Button>}
            {task.state === 'FAILURE' && <Alert severity="error" sx={{mt:1}}>{task.info?.error || 'Task failed.'}</Alert>}
        </Paper>
    );
};

const ProcessingPage = () => {
    // Inputs
    const [file, setFile] = useState(null);
    const [text, setText] = useState('');

    // Tool Options
    const [transcribeLang, setTranscribeLang] = useState('auto');
    const [translateLang, setTranslateLang] = useState('繁體中文');

    // Results
    const [summary, setSummary] = useState('');
    const [actionItems, setActionItems] = useState([]);
    const [translationPreview, setTranslationPreview] = useState('');

    // Unified Task Management
    const [tasks, setTasks] = useState({});
    const [error, setError] = useState('');

    const handleTaskUpdate = useCallback(async (key, updatedTask) => {
        setTasks(prev => ({ ...prev, [key]: updatedTask }));

        if (updatedTask.state === 'SUCCESS') {
            if (key === 'transcribe' && updatedTask.info.download_filename) {
                try {
                    const fileContent = await getFileContent(updatedTask.info.download_filename);
                    setText(fileContent);
                } catch (e) {
                    setError('Failed to fetch transcribed text content.');
                }
            }
            if (key === 'translate' && updatedTask.info.content) {
                setText(updatedTask.info.content);
            }
            if (key === 'summary' && updatedTask.info.summary) {
                setSummary(updatedTask.info.summary);
            }
            if (key === 'action_preview' && updatedTask.info.parsed_items) {
                // Add a temporary unique ID for react keys
                const itemsWithTempId = updatedTask.info.parsed_items.map(item => ({ ...item, tempId: Math.random() }));
                setActionItems(itemsWithTempId);
            }
        }
        if (key === 'translate' && updatedTask.info.preview) {
            setTranslationPreview(updatedTask.info.preview);
        }

    }, []);

    useEffect(() => {
        const intervalIds = Object.entries(tasks).map(([key, task]) => {
            if (task && (task.state === 'PENDING' || task.state === 'PROGRESS')) {
                return setInterval(async () => {
                    try {
                        const updatedTask = await pollTaskStatus(task.status_url);
                        handleTaskUpdate(key, { ...task, ...updatedTask });
                    } catch (err) {
                        console.error(`Polling failed for ${key}:`, err);
                        handleTaskUpdate(key, { ...task, state: 'FAILURE', info: { error: 'Polling failed' } });
                    }
                }, 2000);
            }
            return null;
        }).filter(Boolean);

        return () => intervalIds.forEach(clearInterval);
    }, [tasks, handleTaskUpdate]);

    const handleStartTask = async (key, taskFn, ...args) => {
        setError('');
        setTasks(prev => ({ ...prev, [key]: { state: 'PENDING', info: { status_msg: 'Initializing...' } } }));
        try {
            const result = await taskFn(...args);
            setTasks(prev => ({ ...prev, [key]: { ...prev[key], task_id: result.task_id, status_url: result.status_url, state: 'PENDING' } }));
        } catch (err) {
            const errorMsg = err.response?.data?.error || `Failed to start ${key} task.`;
            setError(errorMsg);
            setTasks(prev => ({ ...prev, [key]: { state: 'FAILURE', info: { error: errorMsg } } }));
        }
    };

    const handleStopTask = async (taskId) => {
        try {
            await stopTask(taskId);
            const taskKey = Object.keys(tasks).find(k => tasks[k].task_id === taskId);
            if (taskKey) {
                setTasks(prev => ({ ...prev, [taskKey]: { ...prev[taskKey], state: 'REVOKED' } }));
            }
        } catch (err) {
            setError('Failed to stop the task.');
        }
    };

    const handlePreviewActions = async () => {
        if (!text) return;
        handleStartTask('action_preview', previewActionItems, text);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>AI Processing Tools</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Card><CardContent>
                        <Typography variant="h6">File-based Tools</Typography>
                        <Button variant="contained" component="label" sx={{ mt: 2 }}>Upload File<input type="file" hidden onChange={e => setFile(e.target.files[0])} /></Button>
                        {file && <Typography sx={{ mt: 1, fontStyle: 'italic' }}>{file.name}</Typography>}
                        <Box sx={{mt:2}}>
                            <Button size="small" variant="outlined" disabled={!file} onClick={() => handleStartTask('extract', extractAudio, file)}>Extract Audio</Button>
                            <TaskMonitor task={tasks.extract} onStop={handleStopTask} />
                        </Box>
                        <Box sx={{mt:2}}>
                            <FormControl size="small" sx={{minWidth: 120}}><InputLabel>Language</InputLabel><Select value={transcribeLang} label="Language" onChange={e => setTranscribeLang(e.target.value)}><MenuItem value="auto">Auto-detect</MenuItem><MenuItem value="en">English</MenuItem><MenuItem value="zh">Chinese</MenuItem></Select></FormControl>
                            <Button size="small" variant="outlined" disabled={!file} onClick={() => handleStartTask('transcribe', transcribeAudio, file, transcribeLang)} sx={{ml:1}}>Transcribe</Button>
                            <TaskMonitor task={tasks.transcribe} onStop={handleStopTask} />
                        </Box>
                        <Box sx={{mt:2}}>
                            <FormControl size="small" sx={{minWidth: 120}}><InputLabel>Target</InputLabel><Select value={translateLang} label="Target" onChange={e => setTranslateLang(e.target.value)}><MenuItem value="繁體中文">繁體中文</MenuItem><MenuItem value="English">English</MenuItem></Select></FormControl>
                            <Button size="small" variant="outlined" disabled={!file && !text} onClick={() => handleStartTask('translate', translateTextFile, file, translateLang)}>Translate</Button>
                            <TaskMonitor task={tasks.translate} onStop={handleStopTask} translationPreview={translationPreview} />
                        </Box>
                    </CardContent></Card>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Card><CardContent>
                        <Typography variant="h6">Text-based Input</Typography>
                        <Typography variant="body2" color="text.secondary">Results from file tools will appear here.</Typography>
                        <TextField label="Text for Processing" multiline rows={13} fullWidth value={text} onChange={e => setText(e.target.value)} sx={{ mt: 2 }} />
                    </CardContent></Card>
                </Grid>
                <Grid item xs={12}>
                     <Card><CardContent>
                        <Typography variant="h6">Summary & Action Items</Typography>
                        <TextProcessingTools 
                            textContent={text}
                            summary={summary}
                            actionItems={actionItems}
                            onGenerateSummary={() => handleStartTask('summary', summarizeText, text)}
                            onPreviewActions={handlePreviewActions}
                            onActionItemChange={(id, field, value) => setActionItems(p => p.map(i => i.tempId === id ? {...i, [field]: value} : i))}
                        />
                        <TaskMonitor task={tasks.summary} onStop={handleStopTask} />
                        <TaskMonitor task={tasks.action_preview} onStop={handleStopTask} />
                    </CardContent></Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ProcessingPage;