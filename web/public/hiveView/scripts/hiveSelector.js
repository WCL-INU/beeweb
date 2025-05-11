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
        const response = await fetch(`${window.BASE_PATH}api/areahive`);
        let data = await response.json();
        console.log(data);
        // 하이브 이름을 기준으로 정렬하고, 하이브가 없는 지역 제거
        data = data
            .filter(area => area.hives.length > 0)
            .map(area => {
                area.hives.sort((a, b) => {
                    const aNumber = parseInt(a.name.replace('Hive ', ''));
                    const bNumber = parseInt(b.name.replace('Hive ', ''));
                    return aNumber - bNumber;
                });
                return area;
            });
        console.log(data);
        return data;
    } catch (error) {
        console.error('Error fetching area and hive data:', error);
    }
}

async function fetchDevicesByHive(hiveId) {
    const url = `${window.BASE_PATH}api/device?hiveId=${hiveId}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
    return data;
}

// ================== URL 파라미터 관리 ==================

// URL 파라미터 업데이트 함수
function updateURLParamsForHive() {
    const hiveSelector = document.getElementById('hive-selector');
    const hiveId = hiveSelector.value;
    const params = new URLSearchParams(window.location.search);

    if (hiveId) {
        params.set('hiveId', hiveId);
    } else {
        params.delete('hiveId');
    }

    const newURL = window.location.pathname + '?' + params.toString();
    window.history.replaceState(null, '', newURL);
}

// URL 파라미터로부터 셀렉터 복구 함수
async function fetchAndRenderDevice() {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const urlHive = urlSearchParams.get('hiveId');
    if (urlHive) {
        const hiveId = parseInt(urlHive);
        const selectedArea = selector_areaHiveDevices.find(area => area.hives.some(hive => hive.id === hiveId));

        const areaSelector = document.getElementById('area-selector');
        areaSelector.value = selectedArea.id;
        updateHives();

        const hiveSelector = document.getElementById('hive-selector');
        hiveSelector.value = hiveId;
        await updateDevices();
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
                    let deviceWitHiveInfo = {
                        id: device.id,
                        name: device.name,
                        type_id: device.type_id,
                        hive_id: hive.id,
                        hive_name: hive.name
                    };
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

    const areaUpdateEvent = new CustomEvent('areaUpdated', { detail: { id: selectedAreaId, name: selectedArea.name } });
    document.dispatchEvent(areaUpdateEvent);
}

async function updateDevices() {
    const hiveSelector = document.getElementById('hive-selector');
    const selectedHiveId = parseInt(hiveSelector.value);
    if (isNaN(selectedHiveId)) return;

    let selector_deviceList = await fetchDevicesByHive(selectedHiveId);
    console.log(`Fetching devices for hive ${selectedHiveId}`);
    if(!selector_deviceList) { return; }

    selector_addDevices(selectedHiveId, selector_deviceList);
    updateURLParamsForHive();
    sendDeviceList();
}

function sendDeviceList() {
    const hiveSelector = document.getElementById('hive-selector');
    const selectedHiveId = hiveSelector.value;

    const selectedArea = selector_areaHiveDevices.find(area => area.hives.some(hive => hive.id === parseInt(selectedHiveId)));
    const selectedHive = selectedArea.hives.find(hive => hive.id === parseInt(selectedHiveId));
    const selected_deviceList = selectedHive.devices;

    for(let device of selected_deviceList) {
        device.hive_id = parseInt(selectedHiveId);
        device.hive_name = selectedHive.name;
    }

    const updateEvent = new CustomEvent('deviceListUpdated', { detail: selected_deviceList });
    document.dispatchEvent(updateEvent);
}

document.addEventListener('DOMContentLoaded', async () => {
    const areaSelector = document.getElementById('area-selector');
    selector_areaHiveDevices = await fetchAreaHiveData();

    selector_areaHiveDevices.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        areaSelector.appendChild(option);
    });

    await fetchAndRenderDevice();
});
