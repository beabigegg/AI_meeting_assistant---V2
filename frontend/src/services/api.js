import axios from 'axios';

// 基底位址：優先走 Vite/環境變數，否則退回 /api
const api = axios.create({
  baseURL: import.meta?.env?.VITE_API_BASE_URL || '/api',
});

// 統一：從 localStorage 取 'token'
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

// Configure the default axios instance to automatically handle the base URL and JWT token
axios.defaults.baseURL = '/api';

axios.interceptors.request.use(config => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

// Helper function to start a task that involves file upload
const startFileUploadTask = async (endpoint, file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    for (const key in options) {
        formData.append(key, options[key]);
    }
    const response = await axios.post(endpoint, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// Helper function to poll for task status
export const pollTaskStatus = async (statusUrl) => {
    const response = await axios.get(statusUrl);
    return response.data;
};

export const stopTask = (taskId) => axios.post(`/task/${taskId}/stop`);

// --- Processing Tasks ---
export const extractAudio = (file) => startFileUploadTask('/extract_audio', file);
export const transcribeAudio = (file, language, useDemucs) => startFileUploadTask('/transcribe_audio', file, { language, use_demucs: useDemucs ? 'on' : 'off' });
export const translateTextFile = (file, targetLanguage) => startFileUploadTask('/translate_text', file, { target_language: targetLanguage });

export const summarizeText = (textContent, conversationId = null, revisionInstruction = null) => {
    return axios.post('/summarize_text', { 
        text_content: textContent, 
        conversation_id: conversationId,
        revision_instruction: revisionInstruction
    }).then(res => res.data); // Return data directly
};

// --- File Download and Content Fetching ---
export const downloadFile = async (filename) => {
    const response = await axios.get(`/download/${filename}`, {
        responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: response.headers['content-type'] });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
};

// New function to get file content as text
export const getFileContent = (filename) => {
    return axios.get(`/download/${filename}`).then(res => res.data);
};

// --- Auth & User Services ---
export const login = (username, password) => axios.post('/login', { username, password });
export const getUsers = () => axios.get('/admin/users').then(res => res.data);

// --- Meeting Services ---
export const getMeetings = () => axios.get('/meetings').then(res => res.data);
export const getMeetingDetails = (meetingId) => axios.get(`/meetings/${meetingId}`).then(res => res.data);
export const createMeeting = (topic, meetingDate) => axios.post('/meetings', { topic, meeting_date: meetingDate });

// --- Action Item API Calls ---
export const getActionItemsForMeeting = (meetingId) => {
    return axios.get(`/meetings/${meetingId}/action_items`).then(res => res.data);
};

export const getActionItemDetails = (itemId) => {
    return axios.get(`/action_items/${itemId}`).then(res => res.data);
};

export const createActionItem = (itemData) => {
    return axios.post('/action_items', itemData);
};

export const updateActionItem = (itemId, updateData) => {
    return axios.put(`/action_items/${itemId}`, updateData);
};

export const deleteActionItem = (itemId) => {
    return axios.delete(`/action_items/${itemId}`);
};

// --- AI-Powered Action Item Flow ---
export const previewActionItems = (textContent) => {
    return axios.post('/preview_action_items', { text: textContent });
};

export const batchCreateActionItems = (meetingId, actionItems) => {
    return axios.post(`/meetings/${meetingId}/action_items/batch`, actionItems);
};

// === AI 同步處理 ===
export const translateText = (text, target_lang = '繁體中文') =>
  api.post('/translate/text', { text, target_lang }).then(r => r.data);

export const summarizeText = (text) =>
  api.post('/summarize/text', { text }).then(r => r.data);

export const previewActionItems = (text) =>
  api.post('/action-items/preview', { text }).then(r => r.data);

// === 代辦儲存 ===
export const createActionItem = (payload) =>
  api.post('/action-items', payload).then(r => r.data);

export const batchSaveActionItems = (meetingId, items) =>
  api.post(`/meetings/${meetingId}/action-items/batch`, { items }).then(r => r.data);

// === 你既有的 API 若已存在就保留；以下是範例 ===
export const getMeetings = () =>
  api.get('/meetings').then(r => r.data);

export const login = (username, password) =>
  api.post('/login', { username, password }).then(r => r.data);
