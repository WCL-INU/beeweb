let fetcher_device = null;
let fetcher_tRange = { sTime: null, eTime: null };

// UTC 문자열을 로컬 시간 문자열로 변환
function toLocalTimeString(utcString) {
    const date = new Date(utcString);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

async function fetchPictureData() {
    try {
        if (!fetcher_device || !fetcher_tRange.sTime || !fetcher_tRange.eTime) return;

        document.dispatchEvent(new Event('loadingStart'));  // 로딩 시작 알림

        const url = `${window.BASE_PATH}api/picture?deviceId=${fetcher_device}&sTime=${fetcher_tRange.sTime}&eTime=${fetcher_tRange.eTime}`;
        const response = await fetch(url);
        const data = await response.json();

        const pictures = data.map(item => ({
            url: `data:image/jpeg;base64,${item.picture}`,
            time: toLocalTimeString(item.time)
        }));

        document.dispatchEvent(new CustomEvent('dataUpdated', { detail: pictures }));

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
