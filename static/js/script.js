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
        const modelSelectSTT = document.getElementById('modelSelectSTT');
        const modelSelectLLM = document.getElementById('modelSelectLLM');
        const toneSelectSTT = document.getElementById('toneSelectSTT');
        const modelSelectTTS = document.getElementById('modelSelectTTS');
        const nameVoiceSelectTTS = document.getElementById('nameVoiceSelectTTS');


        

        let isPlaying = false;
        let currentIndex = -1;
        let audioPlaylist = [];
        let receivedChunks = 0;
        let totalChunks = 0;
        let autoPlay = true;
        let transcriptItems = [];
        let allAudiosFinished = false;
        let generationComplete = false;
        let nameVoiceObjTTS = {
            'elevenlabs/v3_alpha' : ['Alice', 'bb', 'cc'],
            'minimax/speech-2.6-hd' : ['Alice', 'bbb', 'ccc']
        }



        modelSelectTTS.addEventListener('change', () => {
            let modelSelectedTTS = modelSelectTTS.value
            let nameVoiceSelectedTTS = nameVoiceObjTTS[modelSelectedTTS]

            nameVoiceSelectTTS.innerHTML = ""
            nameVoiceSelectedTTS.forEach((nameVoice) => {
                nameVoiceSelectTTS.innerHTML += `<option value="${nameVoice}">${nameVoice}</option>`
                
            })
        })



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
                
                // دسترسی به المان SVG داخل دکمه میکروفون
                const micIcon = document.querySelector('.mic-icon');
                
                if (state === "idle") {
                    // برای حالت idle: دو path اصلی میکروفون (مانند کد فعلی)
                    micIcon.innerHTML = `
                            <path d="M480-415.33q-45.33 0-76.33-32.28t-31-78.39v-247.33q0-44.45 31.29-75.56 31.3-31.11 76-31.11 44.71 0 76.04 31.11 31.33 31.11 31.33 75.56V-526q0 46.11-31 78.39T480-415.33Zm0-232ZM446.67-120v-131.67q-105.34-12-176-90.33Q200-420.33 200-526h66.67q0 88.33 62.36 149.17Q391.38-316 479.86-316q88.47 0 150.97-60.83 62.5-60.84 62.5-149.17H760q0 105.67-70.67 184-70.66 78.33-176 90.33V-120h-66.66ZM480-482q17.67 0 29.17-12.83 11.5-12.84 11.5-31.17v-247.33q0-17-11.69-28.5-11.7-11.5-28.98-11.5t-28.98 11.5q-11.69 11.5-11.69 28.5V-526q0 18.33 11.5 31.17Q462.33-482 480-482Z" />
                    `;
                } else if (state === "recording") {
                    // مثال برای حالت recording: path های متفاوت (مثلاً با موج صدا یا آیکون ضبط)
                    micIcon.innerHTML = `
                            <path d="M234.67-80.67q58.66 0 99.83-31t61.5-85q19-50.66 37.17-76.33 18.16-25.67 72.83-69 64.67-52 96-113t31.33-147.67q0-119.66-77.5-197.5Q478.33-878 358.67-878q-118.34 0-196.84 75.83-78.5 75.84-81.83 191.5h66.67q3.33-87 62.83-143.83 59.5-56.83 149.17-56.83 88.33 0 148.16 60.16 59.84 60.17 59.84 148.5Q566.67-532 539-481t-87.67 96.33q-43.33 32-68.66 66.67-25.34 34.67-44 82-16 42.67-40.84 65.67-24.83 23-63.16 23-34.34 0-59.17-23.84-24.83-23.83-28.17-58.16H80.67q3.33 62 47.66 105.33 44.34 43.33 106.34 43.33Zm124-426.66q40 0 67.66-27.84Q454-563 454-602.67q0-40-27.67-68.33-27.66-28.33-67.66-28.33T290.33-671Q262-642.67 262-602.67q0 39.67 28.33 67.5 28.34 27.84 68.34 27.84Zm386 123-51-50.34q19.66-38.33 29.66-80.83t10-88.5q0-46-10-88.33-10-42.34-29-80.67l50.34-50.33q27 49 41.16 103.83Q800-664.67 800-604.67q0 60.34-14.17 115.5-14.16 55.17-41.16 104.84Zm117 114.66-49.67-48q38.33-62 59.83-134T893.33-602q0-79.33-21.66-151.83Q850-826.33 811-888.33l50-49.34q47.67 72 73.33 156.84Q960-696 960-602.67q0 92.67-25.67 176.84-25.66 84.16-72.66 156.16Z" />
                 `;
                } else if (state === "processing") {
                    // مثال برای حالت paused: path های متفاوت (مثلاً با خط افقی برای توقف)
                    micIcon.innerHTML = `
                            <path d="M480-80q-83.33 0-156.33-31.17-73-31.16-127.17-85.33t-85.33-127.17Q80-396.67 80-480q0-83.67 31.17-156.5 31.16-72.83 85.33-127t127.17-85.33Q396.67-880 480-880q13.67 0 23.5 9.83 9.83 9.84 9.83 23.5 0 13.67-9.83 23.5-9.83 9.84-23.5 9.84-138.33 0-235.83 97.5T146.67-480q0 138.33 97.5 235.83T480-146.67q138.33 0 235.83-97.5T813.33-480q0-13.67 9.84-23.5 9.83-9.83 23.5-9.83 13.66 0 23.5 9.83Q880-493.67 880-480q0 83.33-31.17 156.33-31.16 73-85.33 127.17t-127 85.33Q563.67-80 480-80Z" />
                    `;
                } else if (state === "generating") {
                    // مثال برای حالت error: path های متفاوت (مثلاً علامت خطا)
                    micIcon.innerHTML = `
                            <path d="M80-79.33V-146q48.67 0 96-8t93-24.67q-48-23.66-78.5-66.16t-30.5-95.5V-430h160v-126.67h139L319.33-829.33l60.67-30 139 272.66q17.33 33.34-1.96 65Q497.75-490 460-490h-73.33v53.33q0 30.25-21.55 51.79-21.54 21.55-51.79 21.55h-86.66v23q0 37 22.83 65.5t58.5 38.16l12 3q35.2 8.82 39.6 44.08 4.4 35.26-27.6 53.26Q274-104 210.13-91.67 146.27-79.33 80-79.33Zm566.67-114-47-46.67q22.33-22.33 34.66-50.91 12.34-28.58 12.34-61.83 0-33.26-12.34-61.76Q622-443 599.67-465.33l47-47q30.66 30.66 48.66 71.99 18 41.32 18 87.99 0 46.67-18 87.51t-48.66 71.51Zm113.66 114L712.67-127q43.66-43.67 68.83-101.44 25.17-57.77 25.17-124.23 0-66.66-25.17-124.33t-68.83-101.33L760.33-626q52.67 52.67 82.84 122.61 30.16 69.94 30.16 150.72 0 80.34-30.16 150.5Q813-132 760.33-79.33Z" />
                    `;
                } else {
                    // حالت پیش‌فرض: برگشت به path های idle
                    micIcon.innerHTML = `
                            <path d="M480-415.33q-45.33 0-76.33-32.28t-31-78.39v-247.33q0-44.45 31.29-75.56 31.3-31.11 76-31.11 44.71 0 76.04 31.11 31.33 31.11 31.33 75.56V-526q0 46.11-31 78.39T480-415.33Zm0-232ZM446.67-120v-131.67q-105.34-12-176-90.33Q200-420.33 200-526h66.67q0 88.33 62.36 149.17Q391.38-316 479.86-316q88.47 0 150.97-60.83 62.5-60.84 62.5-149.17H760q0 105.67-70.67 184-70.66 78.33-176 90.33V-120h-66.66ZM480-482q17.67 0 29.17-12.83 11.5-12.84 11.5-31.17v-247.33q0-17-11.69-28.5-11.7-11.5-28.98-11.5t-28.98 11.5q-11.69 11.5-11.69 28.5V-526q0 18.33 11.5 31.17Q462.33-482 480-482Z" />

                    `;
                }
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

        modelSelectSTT.addEventListener('change', () => {
            saveToLocalStorage(modelSelectSTT, 'modelSTT');
        });

        modelSelectLLM.addEventListener('change', () => {
            saveToLocalStorage(modelSelectLLM, 'modelLLM');
        });

        toneSelectSTT.addEventListener('change', () => {
            saveToLocalStorage(toneSelectSTT, 'toneLLM');
        });

        modelSelectTTS.addEventListener('change', () => {
            saveToLocalStorage(modelSelectTTS, 'modelTTS');
        });

        nameVoiceSelectTTS.addEventListener('change', () => {
            saveToLocalStorage(nameVoiceSelectTTS, 'nameVoiceTTS');
        });

        // بارگذاری مقادیر ذخیره‌شده هنگام لود صفحه
        window.addEventListener('load', () => {
            const savedLanguage = localStorage.getItem('language');
            const savedModelSTT = localStorage.getItem('modelSTT');
            const savedModelLLM = localStorage.getItem('modelLLM');
            const savedtoneLLM = localStorage.getItem('toneLLM');
            const savedModelTTS = localStorage.getItem('modelTTS');
            const savedNameVoiceTTS = localStorage.getItem('nameVoiceTTS');

            if (savedLanguage) {
                languageSelect.value = savedLanguage;
            }

            if (savedModelSTT) {
                modelSelectSTT.value = savedModelSTT;
            }

            if (savedModelLLM) {
                modelSelectLLM.value = savedModelLLM;
            }

            if (savedtoneLLM) {
                toneSelectSTT.value = savedtoneLLM;
            }

            if (savedModelTTS) {
                modelSelectTTS.value = savedModelTTS;
            }

            if (savedNameVoiceTTS) {
                nameVoiceSelectTTS.value = savedNameVoiceTTS;
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
                formData.append('modelSTT', document.getElementById('modelSelectSTT').value);
                formData.append('modelLLM', document.getElementById('modelSelectLLM').value);
                formData.append('toneLLM', document.getElementById('toneSelectSTT').value);
                formData.append('modelTTS', document.getElementById('modelSelectTTS').value);
                formData.append('nameVoiceTTS', document.getElementById('nameVoiceSelectTTS').value);


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
                        formData.append('modelSTT', document.getElementById('modelSelectSTT').value);
                        formData.append('modelLLM', document.getElementById('modelSelectLLM').value);
                        formData.append('toneLLM', document.getElementById('toneSelectSTT').value);
                        formData.append('modelTTS', document.getElementById('modelSelectTTS').value);
                        formData.append('nameVoiceTTS', document.getElementById('nameVoiceSelectTTS').value);
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