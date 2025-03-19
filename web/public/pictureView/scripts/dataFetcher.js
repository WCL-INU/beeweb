let fetcher_device = null;
let fetcher_tRange = { sTime: null, eTime: null };

async function fetchPictureData() {
    try {
        if (!fetcher_device || !fetcher_tRange.sTime || !fetcher_tRange.eTime) {
            return;
        }
        const url = `${window.BASE_PATH}api/camera?deviceId=${fetcher_device}&sTime=${fetcher_tRange.sTime}&eTime=${fetcher_tRange.eTime}`;
        const response = await fetch(url);
        let data = await response.json();

        // Buffer 데이터를 Base64로 변환하여 사용할 수 있도록 처리
        const pictures = data.map(item => ({
            url: `data:image/jpeg;base64,${arrayBufferToBase64(item.picture.data)}`, // Buffer 데이터를 Base64로 변환
            time: item.time.replace('T', ' ').replace('.000Z', '') // 시간 포맷 수정
        }));

        // 이벤트로 데이터 전달
        const dataUpdatedEvent = new CustomEvent('dataUpdated', { detail: pictures });
        document.dispatchEvent(dataUpdatedEvent);

    } catch (error) {
        console.error(error);
    }
}

// Buffer 데이터를 Base64로 변환하는 함수
function arrayBufferToBase64(buffer) {
    let binary = '';
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// ================== 장치 선택기의 이벤트 리스너 ==================
document.addEventListener('deviceSelected', async (event) => {
    console.log('deviceSelected:', event.detail.deviceId);
    fetcher_device = event.detail.deviceId;
    await fetchPictureData();
});


// ================== 시간 선택기의 이벤트 리스너 ==================
document.addEventListener('timeRangeUpdated', async (event) => {
    console.log(`Time range updated: ${event.detail.sTime} ~ ${event.detail.eTime}`);
    fetcher_tRange = event.detail;
    await fetchPictureData();
});
