document.addEventListener('DOMContentLoaded', function() {
    // --- Global variables ---
    let statusInterval;
    let currentTaskType = '';
    let summaryConversationId = null;
    let lastSummaryText = '';

    // --- DOM Elements ---
    const progressContainer = document.getElementById('progress-container');
    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-bar');
    const resultContainer = document.getElementById('result-container');
    const textResultPreview = document.getElementById('text-result-preview');
    const downloadLink = document.getElementById('download-link');
    const revisionArea = document.getElementById('revision-area');
    const allActionButtons = document.querySelectorAll('.action-btn');

    // --- Tab Switching Logic ---
    const tabButtons = document.querySelectorAll('#myTab button');
    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', function() {
            resetUiForNewTask();
        });
    });

    // --- Event Listeners for all action buttons ---
    allActionButtons.forEach(button => {
        button.addEventListener('click', handleActionClick);
    });

    function handleActionClick(event) {
        const button = event.currentTarget;
        currentTaskType = button.dataset.task;

        resetUiForNewTask();
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 處理中...';
        progressContainer.style.display = 'block';

        if (currentTaskType === 'summarize_text') {
            const fileInput = document.getElementById('summary-file-input');
            const file = fileInput.files[0];

            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const fileContent = e.target.result;
                    startSummarizeTask(fileContent);
                };
                reader.onerror = function() {
                    handleError("讀取檔案時發生錯誤。");
                };
                reader.readAsText(file);
            } else {
                const textContent = document.getElementById('summary-source-text').value;
                if (!textContent.trim()) {
                    alert('請貼上文字或選擇檔案！');
                    resetButtons();
                    return;
                }
                startSummarizeTask(textContent);
            }
            return;
        }

        let endpoint = '';
        let formData = new FormData();
        let body = null;
        let fileInput;

        switch (currentTaskType) {
            case 'extract_audio':
                endpoint = '/extract_audio';
                fileInput = document.getElementById('video-file');
                break;

            case 'transcribe_audio':
                endpoint = '/transcribe_audio';
                fileInput = document.getElementById('audio-file');
                formData.append('language', document.getElementById('lang-select').value);
                if (document.getElementById('use-demucs').checked) {
                    formData.append('use_demucs', 'on');
                }
                break;

            case 'translate_text':
                endpoint = '/translate_text';
                fileInput = document.getElementById('transcript-file');
                formData.append('target_language', document.getElementById('translate-lang-select').value);
                break;

            case 'revise_summary':
                endpoint = '/summarize_text';
                const instruction = document.getElementById('revision-instruction').value;
                if (!lastSummaryText) { alert('請先生成初版結論！'); resetButtons(); return; }
                if (!instruction.trim()) { alert('請輸入修改指示！'); resetButtons(); return; }
                body = JSON.stringify({
                    text_content: lastSummaryText,
                    revision_instruction: instruction,
                    target_language: document.getElementById('summary-lang-select').value,
                    conversation_id: summaryConversationId
                });
                startFetchTask(endpoint, body, { 'Content-Type': 'application/json' });
                return;

            default:
                console.error('Unknown task type:', currentTaskType);
                resetButtons();
                return;
        }

        if (!fileInput || !fileInput.files[0]) {
            alert('請選擇一個檔案！');
            resetButtons();
            return;
        }
        formData.append('file', fileInput.files[0]);
        body = formData;

        startFetchTask(endpoint, body);
    }

    function startSummarizeTask(textContent) {
        summaryConversationId = null;
        lastSummaryText = textContent;
        const body = JSON.stringify({
            text_content: textContent,
            target_language: document.getElementById('summary-lang-select').value
        });
        startFetchTask('/summarize_text', body, { 'Content-Type': 'application/json' });
    }

    function startFetchTask(endpoint, body, headers = {}) {
        updateProgress(0, '準備上傳與處理...');
        fetch(endpoint, {
            method: 'POST',
            body: body,
            headers: headers
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || '伺服器錯誤') });
            }
            return response.json();
        })
        .then(data => {
            if (data.task_id) {
                statusInterval = setInterval(() => checkTaskStatus(data.status_url), 2000);
            } else {
                handleError(data.error || '未能啟動背景任務');
            }
        })
        .catch(error => {
            handleError(error.message || '請求失敗');
        });
    }

    function checkTaskStatus(statusUrl) {
        fetch(statusUrl)
        .then(response => response.json())
        .then(data => {
            const info = data.info || {};
            if (data.state === 'PROGRESS') {
                updateProgress(info.current, info.status, info.total);
                const previewContent = info.content || info.summary || info.preview;
                if (previewContent) {
                    resultContainer.style.display = 'block';
                    textResultPreview.textContent = previewContent;
                    textResultPreview.style.display = 'block';
                }
            } else if (data.state === 'SUCCESS') {
                clearInterval(statusInterval);
                updateProgress(100, info.status || '完成！', 100);
                displayResult(info);
                resetButtons();
            } else if (data.state === 'FAILURE') {
                clearInterval(statusInterval);
                handleError(info.exc_message || '任務執行失敗');
            }
        })
        .catch(error => {
            clearInterval(statusInterval);
            handleError('查詢進度時發生網路錯誤: ' + error);
        });
    }

    function updateProgress(current, text, total = 100) {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        progressBar.style.width = percent + '%';
        progressBar.setAttribute('aria-valuenow', percent);
        progressBar.textContent = percent + '%';
        statusText.textContent = text;
    }

    function displayResult(info) {
        resultContainer.style.display = 'block';
        
        const content = info.content || info.summary;
        if (content) {
            textResultPreview.textContent = content;
            textResultPreview.style.display = 'block';
            lastSummaryText = content;
        } else {
            textResultPreview.style.display = 'none';
        }

        if (info.download_url) {
            downloadLink.href = info.download_url;
            downloadLink.style.display = 'inline-block';
        }

        if (currentTaskType === 'summarize_text' || currentTaskType === 'revise_summary') {
            revisionArea.style.display = 'block';
            summaryConversationId = info.conversation_id;
        }
    }

    function handleError(message) {
        statusText.textContent = `錯誤：${message}`;
        progressBar.classList.add('bg-danger');
        resetButtons();
    }

    function resetUiForNewTask() {
        if (statusInterval) clearInterval(statusInterval);

        progressContainer.style.display = 'none';
        resultContainer.style.display = 'none';
        textResultPreview.style.display = 'none';
        textResultPreview.textContent = '';
        downloadLink.style.display = 'none';
        revisionArea.style.display = 'none';

        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        progressBar.textContent = '0%';
        progressBar.classList.remove('bg-danger');
        statusText.textContent = '';

        resetButtons();
    }

    function resetButtons() {
        allActionButtons.forEach(button => {
            button.disabled = false;
            const task = button.dataset.task;
            let iconHtml = '';
            let text = '';

            switch(task) {
                case 'extract_audio':
                    iconHtml = '<i class="bi bi-arrow-repeat me-2"></i>';
                    text = '開始轉換';
                    break;
                case 'transcribe_audio':
                    iconHtml = '<i class="bi bi-mic-fill me-2"></i>';
                    text = '開始轉錄';
                    break;
                case 'translate_text':
                    iconHtml = '<i class="bi bi-translate me-2"></i>';
                    text = '開始翻譯';
                    break;
                case 'summarize_text':
                    iconHtml = '<i class="bi bi-card-text me-2"></i>';
                    text = '產生初版結論';
                    break;
                case 'revise_summary':
                    iconHtml = '<i class="bi bi-pencil-square me-2"></i>';
                    text = '根據指示產生修改版';
                    break;
            }
            button.innerHTML = iconHtml + text;
        });
    }
});
