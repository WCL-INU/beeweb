let deviceTypes = [];
let isPageLoading = true;  // 문서 로드 플래그

// 공통 fetch 함수
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error);
        throw error;
    }
}

// URL 업데이트 함수 (입력된 파라미터에 따라 하위 값 제거)
function updateURL(params) {
    if (isPageLoading) return;  // 문서 로드 중일 때는 URL 업데이트 방지

    const searchParams = new URLSearchParams(window.location.search);

    // URL 파라미터 업데이트
    Object.keys(params).forEach(key => {
        if (params[key]) {
            searchParams.set(key, params[key]);  // 파라미터 추가 또는 업데이트
        } else {
            searchParams.delete(key);  // 파라미터 삭제 (빈 값인 경우)
        }
    });

    // areaId가 변경된 경우 hiveId와 deviceId 제거
    if (params.hasOwnProperty('areaId')) {
        searchParams.delete('hiveId');
        searchParams.delete('deviceId');

        // device null로 이벤트 전송
        const deviceChangeEvent = new CustomEvent('deviceSelected', { detail: { deviceId: null } });
        document.dispatchEvent(deviceChangeEvent);
    }
    // hiveId가 변경된 경우 deviceId 제거
    else if (params.hasOwnProperty('hiveId')) {
        searchParams.delete('deviceId');

        // device null로 이벤트 전송
        const deviceChangeEvent = new CustomEvent('deviceSelected', { detail: { deviceId: null } });
        document.dispatchEvent(deviceChangeEvent);
    }

    const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
    history.pushState(null, '', newUrl);  // URL 업데이트
}

// Select 업데이트 함수
function updateSelect(element, data) {
    if (!element || !data) return;
    element.innerHTML = '<option value="">선택</option>';
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        element.appendChild(option);
    });
}

// Device 변경 핸들러
function handleDeviceChange(event) {
    const selectedDeviceId = event.target.value;
    console.log('Selected device ID:', selectedDeviceId);

    // URL에 deviceId 추가
    updateURL({ deviceId: selectedDeviceId });

    // Event 만들어서 넘기기
    const deviceChangeEvent = new CustomEvent('deviceSelected', { detail: { deviceId: selectedDeviceId } });
    document.dispatchEvent(deviceChangeEvent);
}

// Hive 목록 로드
async function loadHives(areaId) {
    const hiveSelect = document.getElementById('hive-select');
    const deviceList = document.getElementById('device-list');

    hiveSelect.innerHTML = '<option value="">선택</option>';

    if (areaId) {
        updateURL({ areaId });  // areaId가 변경되면 hiveId와 deviceId는 자동으로 삭제
        deviceList.innerHTML = '';  // Hive가 변경되면 Device 목록 초기화
        const hiveData = await fetchData(`${window.BASE_PATH}api/hive?areaId=${areaId}`);
        if (hiveData && hiveData.length > 0) {
            updateSelect(hiveSelect, hiveData);
            hiveSelect.disabled = false;  // Hive 목록이 있으면 활성화
        } else {
            hiveSelect.disabled = true;  // Hive 목록이 없으면 비활성화
        }
    }
}

// Device 목록 로드
async function loadDevices(hiveId) {
    const deviceList = document.getElementById('device-list');
    deviceList.innerHTML = '';  // 기존 목록 초기화

    if (hiveId) {
        updateURL({ hiveId });  // hiveId가 변경되면 deviceId는 자동으로 삭제

        const deviceData = await fetchData(`${window.BASE_PATH}api/device?hiveId=${hiveId}`);
        if (deviceData && deviceData.length > 0) {
            deviceData.forEach(device => {
                const deviceType = deviceTypes.find(type => type.id === device.type_id);
                if (!deviceType || deviceType.name !== 'CAMERA') return;

                const deviceItem = document.createElement('div');
                deviceItem.classList.add('device-item');

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'device';
                radio.value = device.id;
                radio.id = `device-${device.id}`;

                radio.addEventListener('change', handleDeviceChange);

                const label = document.createElement('label');
                label.setAttribute('for', `device-${device.id}`);
                label.innerHTML = device.name;

                deviceItem.appendChild(radio);
                deviceItem.appendChild(label);
                deviceList.appendChild(deviceItem);
            });
            deviceList.disabled = false;
        }
    }
}

// 문서 로드시 Area, Hive, Device 데이터 로드
document.addEventListener('DOMContentLoaded', async function () {
    deviceTypes = await fetchData(`${window.BASE_PATH}api/devicetypes`);
    const areaData = await fetchData(`${window.BASE_PATH}api/area`);
    const areaSelect = document.getElementById('area-select');
    updateSelect(areaSelect, areaData);

    // URL에 이미 값이 있으면 그 값으로 로드
    const searchParams = new URLSearchParams(window.location.search);
    const areaId = searchParams.get('areaId');
    const hiveId = searchParams.get('hiveId');
    const deviceId = searchParams.get('deviceId');

    if (areaId) {
        await loadHives(areaId);  // areaId에 맞는 Hive 로드
        areaSelect.value = areaId;

        if (hiveId) {
            const hiveSelect = document.getElementById('hive-select');
            hiveSelect.value = hiveId;
            await loadDevices(hiveId);  // hiveId에 맞는 Device 로드

            if (deviceId) {
                const preselectedRadio = document.getElementById(`device-${deviceId}`);
                if (preselectedRadio) {
                    preselectedRadio.checked = true;
                }
                
                // Event 만들어서 넘기기
                const deviceChangeEvent = new CustomEvent('deviceSelected', { detail: { deviceId } });
                document.dispatchEvent(deviceChangeEvent);
            }
        }
    }

    // 문서 로드가 끝났으므로 URL 업데이트 활성화
    isPageLoading = false;
});
