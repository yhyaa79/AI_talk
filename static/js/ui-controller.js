// مدیریت وضعیت UI، تغییر حالت‌ها، اسکرول و کنترل‌های بصری


// تغییر وضعیت با انیمیشن
function setStatus(text, state) {
    const micArea = document.getElementById('micArea');
    statusText.classList.add('fade');
    micArea.className = 'mic-area';
    console.log("state", state);

    const activeStates = ["processing", "recording", "generating"];
    if (activeStates.includes(state)) {
        stopProcess.style.display = 'flex';
    } else {
        stopProcess.style.display = 'none';
    }

    setTimeout(() => {
        statusText.textContent = text;
        micArea.classList.add(`state-${state}`);
        statusText.classList.remove('fade');
    }, 300);
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

// بررسی تکمیل فرایند
function checkIfComplete() {
    if (generationComplete && allAudiosFinished) {
        setStatus('آماده برای گفتگو', 'idle');
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
            item.style.height = "35px"
        });
        statusAnimation.style.removeProperty('--vol');

        // return dots to default height

    }
}