// مدیریت visualization صدای ورودی (میکروفون) و خروجی (TTS)



// راه‌اندازی Audio Context
function initAudioViz() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
    }
}

// شروع visualization ورودی
function startInputViz() {
    if (inputVizInterval) clearInterval(inputVizInterval);
    inputVizInterval = setInterval(updateInputViz, 60);
}

// به‌روزرسانی visualization ورودی
function updateInputViz() {
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] / 128.0) - 1.0;
        sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const vol = 0.8 + (rms * 1.8);
    statusAnimation.style.setProperty('--vol', vol);
}

// محاسبه حجم صدا برای voice activation
function getVolume() {
    if (!analyser) return 0;
    const dataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] / 128.0) - 1.0;
        sum += val * val;
    }
    return Math.sqrt(sum / dataArray.length);
}

// شروع visualization خروجی
function startOutputViz() {
    if (outputVizInterval) clearInterval(outputVizInterval);
    outputVizInterval = setInterval(updateOutputViz, 60);
}

// به‌روزرسانی visualization خروجی
function updateOutputViz() {
    if (!analyser) return;
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    const bands = 5;
    const bandWidth = Math.floor(freqData.length / bands);
    const vizItems = document.querySelectorAll('.status-animation .viz-item');
    for (let i = 0; i < bands; i++) {
        let sum = 0;
        const start = i * bandWidth;
        const end = Math.min(start + bandWidth, freqData.length);
        for (let j = start; j < end; j++) {
            sum += freqData[j];
        }
        const avg = sum / (end - start) / 255;
        const baseHeight = 35;
        const maxHeight = baseHeight * 8;
        const height = baseHeight + (avg * (maxHeight - baseHeight));
        vizItems[i].style.width = '35px';
        vizItems[i].style.height = `${height}px`;
        vizItems[i].style.borderRadius = '17.5px';
    }
}