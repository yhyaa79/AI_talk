// ارتباط با سرور، ارسال صدا و دریافت stream



// ارسال صدا به سرور
function sendAudioStream(formData) {
    let session_id = localStorage.getItem('user_session_id');
    if (!session_id) {
        session_id = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('user_session_id', session_id);
    }

    formData.append('session_id', session_id);

    fetch('/process_audio_stream', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                if (response.status === 429) {
                    alert(err.error);
                    setStatus('لطفا ساعتی دیگر امتحان کنید', 'idle');
                } else {
                    throw new Error(err.error || 'خطا در سرور: ' + response.statusText);
                }
            });
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        function readStream() {
            reader.read().then(({ done, value }) => {
                if (done) return;

                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            handleStreamData(data);
                        } catch (e) {
                            console.error('خطا در parse SSE:', e);
                        }
                    }
                });

                readStream();
            }).catch(err => {
                setStatus('خطا در ارتباط با سرور', 'idle');
            });
        }

        readStream();
    })
    .catch(err => {
        if (err.message.includes('محدودیت ارسال پیام')) {
            alert(err.message);
            setStatus('لطفا ساعتی دیگر امتحان کنید', 'idle');
        } else {
            setStatus('خطا: ' + err.message, 'idle');
        }
    });
}

// مدیریت داده‌های دریافتی از stream
function handleStreamData(data) {
    if (data.type === 'start') {
        totalChunks = data.total_chunks;
        receivedChunks = 0;
        audioPlaylist = [];
        currentIndex = -1;
        isPlaying = false;
        allAudiosFinished = false;
        generationComplete = false;
    } else if (data.type === 'audio_chunk') {
        addAudioToPlaylist(data.index, data.chunk_text, data.audio_b64);
    } else if (data.type === 'error_chunk') {
        console.error(`خطا در قطعه ${data.index}: ${data.message}`);
    } else if (data.type === 'end') {
        generationComplete = true;
        checkIfComplete();
        if (autoPlay && !isPlaying && currentIndex === -1) {
            playNext();
        }
    } else if (data.error) {
        setStatus('خطا: ' + data.error, 'idle');
    }
}

// پاک کردن تاریخچه
async function clearHistory() {
    try {
        const response = await fetch("/clear_history", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            transcriptArea.innerHTML = '<div class="empty-state">هنوز پیامی ارسال نشده است</div>';
            audioPlaylist = [];
            transcriptItems = [];
            allAudiosFinished = false;
            generationComplete = false;
            if (inputVizInterval) {
                clearInterval(inputVizInterval);
                inputVizInterval = null;
            }
            if (outputVizInterval) {
                clearInterval(outputVizInterval);
                outputVizInterval = null;
            }
            if (sourceRecording) {
                sourceRecording.disconnect();
                sourceRecording = null;
            }
            const vizItems = document.querySelectorAll('.viz-item');
            vizItems.forEach(item => {
                item.style.removeProperty('--offset');
            });
            statusAnimation.style.removeProperty('--vol');
            setStatus('آماده برای گفتگو', 'idle');
        } else {
            setStatus('خطا در بازنشانی', 'idle');
        }
    } catch (err) {
        setStatus('خطا در ارتباط با سرور', 'idle');
    }
}

// لغو جلسه
async function cancelSession() {
    try {
        const response = await fetch("/cancel_session", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ session_id: 'default' })
        });

        if (response.ok) {
            stopAllAudio();
            setStatus('آماده برای گفتگو', 'idle');
        } else {
            setStatus('خطا در متوقف کردن', 'idle');
        }
    } catch (err) {
        setStatus('خطا در ارتباط با سرور', 'idle');
    }
}