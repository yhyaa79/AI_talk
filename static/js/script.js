        let mediaRecorder;
        let audioChunks = [];
        let isRecording = false;
        const micBtn = document.getElementById('micBtn');
        const statusText = document.getElementById('statusText');
        const micArea = document.getElementById('micArea');
        const transcriptArea = document.getElementById('transcriptArea');
        const audioFileInput = document.getElementById('audioFile');
        const sendFileBtn = document.getElementById('sendFileBtn');
        const resetButton = document.getElementById('resetButton');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsPanel = document.getElementById('settingsPanel');
        const settingsClose = document.getElementById('settingsClose');
        const mainContent = document.getElementById('mainContent');
        const replayButton = document.getElementById('replayButton');
        const languageSelect = document.getElementById('languageSelect');
        const modelSelect = document.getElementById('modelSelect');

        let isPlaying = false;
        let currentIndex = -1;
        let audioPlaylist = [];
        let receivedChunks = 0;
        let totalChunks = 0;
        let autoPlay = true;
        let transcriptItems = [];
        let allAudiosFinished = false;
        let generationComplete = false;

        // Settings Toggle
        settingsBtn.addEventListener('click', () => {
            mainContent.classList.add('hidden');
            settingsPanel.classList.remove('hidden');
            settingsBtn.classList.add('active');
        });

        settingsClose.addEventListener('click', () => {
            settingsPanel.classList.add('hidden');
            mainContent.classList.remove('hidden');
            settingsBtn.classList.remove('active');
        });

        // Status change with animation
        function setStatus(text, state) {
            statusText.classList.add('fade');
            micArea.className = 'mic-area';

            setTimeout(() => {
                statusText.textContent = text;
                micArea.classList.add(`state-${state}`);
                statusText.classList.remove('fade');
            }, 300);
        }

        // Check if everything is complete
        function checkIfComplete() {
            if (generationComplete && allAudiosFinished) {
                setStatus('آماده برای گفتگو', 'idle');
            }
        }

        // اسکرول به پایین قسمت نمایش متن
        function scrollToBottom() {
            const element = document.getElementById('transcriptArea');
            if (element) {
                element.scrollTop = element.scrollHeight;
            } else {
                console.warn('المان با id="transcriptArea" پیدا نشد!');
            }
        }


        // تابع برای ذخیره مقدار در localStorage
        function saveToLocalStorage(selectElement, key) {
            localStorage.setItem(key, selectElement.value);
        }

        // افزودن Event Listener برای ذخیره تغییرات
        languageSelect.addEventListener('change', () => {
            saveToLocalStorage(languageSelect, 'language');
        });

        modelSelect.addEventListener('change', () => {
            saveToLocalStorage(modelSelect, 'model');
        });

        // بارگذاری مقادیر ذخیره‌شده هنگام لود صفحه
        window.addEventListener('load', () => {
            const savedLanguage = localStorage.getItem('language');
            const savedModel = localStorage.getItem('model');

            if (savedLanguage) {
                languageSelect.value = savedLanguage;
            }

            if (savedModel) {
                modelSelect.value = savedModel;
            }
        });


        // File Upload
        sendFileBtn.addEventListener('click', () => {
            audioFileInput.click();
        });

        audioFileInput.addEventListener('change', (e) => {
            const selectedFile = e.target.files[0];
            if (selectedFile) {
                const renamedFile = new File([selectedFile], 'user_audio.mp3', {
                    type: 'audio/mpeg'
                });
                const formData = new FormData();
                formData.append('audio', renamedFile);
                formData.append('language', document.getElementById('languageSelect').value);
                formData.append('model', document.getElementById('modelSelect').value);
                sendAudioStream(formData);
                setStatus('در حال پردازش فایل...', 'processing');
            }
        });

        // Microphone Recording
        micBtn.addEventListener('click', async () => {
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: true
                    });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, {
                            type: 'audio/mpeg'
                        });
                        const formData = new FormData();
                        formData.append('audio', audioBlob, 'user_audio.mp3');
                        formData.append('language', document.getElementById('languageSelect').value);
                        formData.append('model', document.getElementById('modelSelect').value);
                        sendAudioStream(formData);
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    setStatus('در حال ضبط صدا...', 'recording');
                } catch (err) {
                    setStatus('خطا در دسترسی به میکروفون', 'idle');
                }
            } else {
                mediaRecorder.stop();
                isRecording = false;
                setStatus('در حال پردازش...', 'processing');
            }
        });

        function base64ToBlob(base64, mimeType = 'audio/mpeg') {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], {
                type: mimeType
            });
        }

        function playNext() {
            if (currentIndex + 1 < audioPlaylist.length && !isPlaying) {
                currentIndex++;
                const audio = audioPlaylist[currentIndex];
                audio.play().then(() => {
                    isPlaying = true;
                }).catch(err => {
                    console.log('خطا در پخش:', err);
                    isPlaying = false;
                    playNext();
                });
            } else if (currentIndex + 1 >= audioPlaylist.length) {
                allAudiosFinished = true;
                checkIfComplete();
            }
        }

        function onEnded() {
            isPlaying = false;
            playNext();
        }

        function addAudioToPlaylist(index, chunkText, audioB64) {
            const blob = base64ToBlob(audioB64);
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.addEventListener('ended', onEnded);
            audioPlaylist.push(audio);

            // Add to transcript
            const item = document.createElement('div');
            item.className = 'transcript-item';

            const text = document.createElement('div');
            text.className = 'transcript-text';
            text.textContent = chunkText;

            const audioEl = document.createElement('audio');
            audioEl.src = url;
            audioEl.controls = true;
            audioEl.className = 'transcript-audio';

            item.appendChild(text);
            item.appendChild(audioEl);

            // Remove empty state
            const emptyState = transcriptArea.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }

            transcriptArea.appendChild(item);
            transcriptItems.push(item);

            // Show replay button
            if (audioPlaylist.length > 0) {
                replayButton.style.display = 'flex';
            }

            receivedChunks++;

            if (autoPlay && !isPlaying) {
                playNext();
            }

            scrollToBottom()
        }

        function sendAudioStream(formData) {
            fetch('/process_audio_stream', {
                    method: 'POST',
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('خطا در سرور: ' + response.statusText);
                    }
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    function readStream() {
                        reader.read().then(({
                            done,
                            value
                        }) => {
                            if (done) {
                                return;
                            }
                            buffer += decoder.decode(value, {
                                stream: true
                            });
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
                    setStatus('خطا: ' + err.message, 'idle');
                });
        }

        function handleStreamData(data) {
            if (data.type === 'start') {
                totalChunks = data.total_chunks;
                receivedChunks = 0;
                audioPlaylist = [];
                currentIndex = -1;
                isPlaying = false;
                allAudiosFinished = false;
                generationComplete = false;
                setStatus('تولید پاسخ هوش مصنوعی...', 'generating');
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

        // Reset History
        resetButton.addEventListener('click', async () => {

            try {
                const response = await fetch("/reset_history", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    transcriptArea.innerHTML = '<div class="empty-state">هنوز پیامی ارسال نشده است</div>';
                    audioPlaylist = [];
                    transcriptItems = [];
                    replayButton.style.display = 'none';
                    allAudiosFinished = false;
                    generationComplete = false;
                    setStatus('آماده برای گفتگو', 'idle');
                } else {
                    setStatus('خطا در بازنشانی', 'idle');
                }
            } catch (err) {
                setStatus('خطا در ارتباط با سرور', 'idle');
            }
        });

        // Replay All
        replayButton.addEventListener('click', () => {
            currentIndex = -1;
            isPlaying = false;
            allAudiosFinished = false;
            playNext();
        });