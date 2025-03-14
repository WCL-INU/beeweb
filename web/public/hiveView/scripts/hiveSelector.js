let selector_areaHiveDevices = [];

function selector_addDevices(hiveId, devices) {

    for(const area of selector_areaHiveDevices) {
        if(!area.hives) { continue; }
        for(const hive of area.hives) {
            if(hive.id == hiveId) {
                hive.devices = devices;
                return;
            }
        }
    }
}

async function fetchAreaHiveData() {
    try {
        const response = await fetch('api/areahive');
        let data = await response.json();

        // 하이브 이름을 기준으로 정렬하고, 하이브가 없는 지역 제거
        data = data
            .filter(area => area.hives.length > 0) // 하이브가 있는 지역만 남김
            .map(area => {
                area.hives.sort((a, b) => {
                    const aNumber = parseInt(a.name.replace('Hive ', ''));
                    const bNumber = parseInt(b.name.replace('Hive ', ''));
                    return aNumber - bNumber;
                });
                return area;
            });

        return data;
    } catch (error) {
        console.error('Error fetching area and hive data:', error);
    }
}

async function fetchDevicesByHive(hiveId) {
    const url = `api/device?hiveId=${hiveId}`;
    const response = await fetch(url);
    const data = await response.json();
    return data;
  }

// ================== URL 파라미터 관리 ==================

// URL 파라미터 업데이트 함수
function updateURLParamsForHive() {

    // hiveSelctor에서 hiveId를 가져옴
    const hiveSelector = document.getElementById('hive-selector');
    const hiveId = hiveSelector.value;

    // URLSearchParams 객체를 생성하고, 기존 URL 파라미터를 가져옴
    const params = new URLSearchParams(window.location.search);

    // URL 파라미터를 업데이트함
    if (hiveId) {
        params.set('hiveId', hiveId);
    } else {
        params.delete('hiveId');
    }

    // 새로운 URL을 생성하고, 히스토리를 업데이트합니다.
    const newURL = window.location.pathname + '?' + params.toString();
    window.history.replaceState(null, '', newURL);
}

// URL 파라미터로부터 셀렉터 복구 함수
async function fetchAndRenderDevice() {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const urlHive = urlSearchParams.get('hiveId');
    if (urlHive) {

        // hiveId를 가진 area를 찾음
        const hiveId = parseInt(urlHive);
        const selectedArea = selector_areaHiveDevices.find(area => area.hives.some(hive => hive.id === hiveId));

        // 드롭박스에 해당 area를 선택함
        const areaSelector = document.getElementById('area-selector');
        areaSelector.value = selectedArea.id;
        updateHives();

        // 드롭박스에 해당 hive를 선택함
        const hiveSelector = document.getElementById('hive-selector');
        hiveSelector.value = hiveId;
        await updateDevices();

        // console.log(`Fetching devices for hive ${hiveId}`);
        // sendDeviceList();
    }
}

// 이벤트 발생시키는 함수
function sendDeviceList() {
    let selected_deviceList = [];

    for (const area of selector_areaHiveDevices) {
        if(!area.hives) { continue; }
        for (const hive of area.hives) {
            if(!hive.devices) { continue; }
            for (const device of hive.devices) {
                if(device.isChecked) {
                    // device에 hive_name 추가
                    let deviceWitHiveInfo = {id: device.id, name: device.name, type_id: device.type_id, hive_id:hive.id, hive_name: hive.name};
                    selected_deviceList.push(deviceWitHiveInfo);
                }
            }
        }
    }

    const updateEvent = new CustomEvent('deviceListUpdated', { detail: selected_deviceList });
    document.dispatchEvent(updateEvent);
}



// Update hives dropdown based on selected area
function updateHives() {
    const areaSelector = document.getElementById('area-selector');
    const hiveSelector = document.getElementById('hive-selector');
    const selectedAreaId = parseInt(areaSelector.value);
    hiveSelector.innerHTML = '<option value="">Select Hive</option>';

    if (isNaN(selectedAreaId)) { return; }

    const selectedArea = selector_areaHiveDevices.find(area => area.id === selectedAreaId);

    if (!selectedArea) { return; }

    selectedArea.hives.forEach(hive => {
        const option = document.createElement('option');
        option.value = hive.id;
        option.textContent = hive.name;
        hiveSelector.appendChild(option);
    });

    // map 업데이트하는데다 전달하기 위한 DOM 이벤트 발생
    const areaUpdateEvent = new CustomEvent('areaUpdated', { detail: { id: selectedAreaId, name: selectedArea.name } });
    document.dispatchEvent(areaUpdateEvent);
}

async function updateDevices() {
    const hiveSelector = document.getElementById('hive-selector');
    const selectedHiveId = parseInt(hiveSelector.value);
    if (isNaN(selectedHiveId)) return;

    // hiveId를 바탕으로 디바이스 목록 획득
    let selector_deviceList = await fetchDevicesByHive(selectedHiveId);
    console.log(`Fetching devices for hive ${selectedHiveId}`);
    if(!selector_deviceList) { return; }

    // areaHives에 devices 추가
    selector_addDevices(selectedHiveId, selector_deviceList);

    // url에 hiveId 설정
    updateURLParamsForHive();

    // 이벤트 발생
    sendDeviceList();
}

function sendDeviceList() {
    // 선택된 hiveId를 가져옴
    const hiveSelector = document.getElementById('hive-selector');
    const selectedHiveId = hiveSelector.value;

    // hiveId를 가진 area를 찾음
    const selectedArea = selector_areaHiveDevices.find(area => area.hives.some(hive => hive.id === parseInt(selectedHiveId)));

    // hive 하위의 devices 목록을 가져옴
    const selectedHive = selectedArea.hives.find(hive => hive.id === parseInt(selectedHiveId));
    const selected_deviceList = selectedHive.devices;

    for(let device of selected_deviceList) {
        device.hive_id = parseInt(selectedHiveId);
        device.hive_name = selectedHive.name;
    }

    // 이벤트 발생
    const updateEvent = new CustomEvent('deviceListUpdated', { detail: selected_deviceList });
    document.dispatchEvent(updateEvent);
}

document.addEventListener('DOMContentLoaded', async () => {

    const areaSelector = document.getElementById('area-selector');
    selector_areaHiveDevices = await fetchAreaHiveData();

    // Populate the area dropdown
    selector_areaHiveDevices.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        areaSelector.appendChild(option);
    });

    // 페이지 로드 시 URL 파라미터로부터 셀렉터 복구
    await fetchAndRenderDevice();
});
