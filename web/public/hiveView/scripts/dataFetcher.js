let fetcher_deviceList = [];
let fetcher_tRange = {sTime: null, eTime: null};
let fetcher_dataList = [];

async function fetchSensor2Data(deviceId, sTime, eTime, dataTypes, level) {
    const typeStr = Array.isArray(dataTypes) ? dataTypes.join(',') : String(dataTypes);

    // ✅ 어떤 값이 들어와도 ISO(+Z)로 정규화
    const sIso = new Date(sTime).toISOString();
    const eIso = new Date(eTime).toISOString();

    const url = new URL(`${window.BASE_PATH}api/data/sensor2`, window.location.origin);
    url.search = new URLSearchParams({
        deviceId: String(deviceId),
        sTime: sIso,
        eTime: eIso,
        dataTypes: typeStr,
        level, // 요약을 먼저 검증하고 싶으면 '5m'로 고정
    }).toString();

    const response = await fetch(url.href);

    if (response.status === 404) return [];
    if (!response.ok) return [];

    const body = await response.json();
    const rows = Array.isArray(body) ? body : body.data;
    return Array.isArray(rows) ? rows : [];
}

async function fetchDataList() {
    fetcher_dataList = [];
    let i = 0;

    for (const device of fetcher_deviceList) {
        let dataTypes = [];
        let typeMap = {}; // data_type -> label

        if (device.type_id == 2) {
            dataTypes = [4, 5, 6, 7];  // TEMP, HUMI, CO2, WEIGH
            typeMap = {
                4: 'Temp',
                5: 'Humi',
                6: 'CO2',
                7: 'Weight'
            };
        } else if (device.type_id == 3) {
            dataTypes = [2, 3];  // IN, OUT
            typeMap = {
                2: 'In',
                3: 'Out'
            };
        } else {
            continue;
        }

        const data = await fetchSensor2Data(device.id, fetcher_tRange.sTime, fetcher_tRange.eTime, dataTypes);

        for (const typeId of dataTypes) {
            const label = typeMap[typeId];

            const parsed = data
                .filter(d => d.data_type === typeId)
                .map(d => ({
                    id: d.id,
                    value: d.value,
                    time: d.time
                }));
            
            // 빈 데이터는 무시
            if (!parsed.length) continue;
    
            const deviceMeta = {
                id: i++,
                type: label,
                hive_name: device.hive_name,
                name: device.name
            };

            fetcher_dataList.push({ device: deviceMeta, data: parsed });
        }
    }

    const updateEvent = new CustomEvent('dataUpdated', { detail: fetcher_dataList });
    document.dispatchEvent(updateEvent);
}

// ================== 장치 선택기의 이벤트 리스너 ==================
document.addEventListener('deviceListUpdated', async (event) => {
    console.log('[DataFetcher] deviceListUpdated:', event.detail);

    fetcher_deviceList = event.detail;
    await fetchDataList();
});


// ================== 시간 선택기의 이벤트 리스너 ==================
document.addEventListener('timeRangeUpdated', async (event) => {
    console.log(`[DataFetcher] Time range updated: ${event.detail.sTime} ~ ${event.detail.eTime}`);
    fetcher_tRange = event.detail;
    if(fetcher_deviceList.length > 0) {
        await fetchDataList();
    }
});


// ================== latestInfo의 이벤트 리스너 ==================
document.addEventListener('dataUpdated', (event) => {
    console.log('[DataFetcher] dataLoaded:', fetcher_dataList);
    const dataList = event.detail;
    console.log('[DataFetcher] dataList:', dataList);

    const latestInData = getLatestData(dataList, 'In');
    const latestOutData = getLatestData(dataList, 'Out');
    const latestTempData = getLatestData(dataList, 'Temp');
    const latestHumiData = getLatestData(dataList, 'Humi');
    const latestCO2Data = getLatestData(dataList, 'CO2');
    const latestWeightData = getLatestData(dataList, 'Weight');

    // I/O 데이터는 특별히 처리
    const ioValue = document.querySelector('#io-value');
    const ioTime = document.querySelector('#io-time');
    if (latestInData && latestOutData) {
        ioValue.textContent = `${latestInData.value} / ${latestOutData.value}`;
        ioTime.textContent = convertISOStringToLocalString(latestInData.time);
    } else {
        ioValue.textContent = 'N/A';
        ioTime.textContent = '';
    }

    updateInfo('temp', latestTempData);
    updateInfo('humi', latestHumiData);
    updateInfo('co2', latestCO2Data);
    updateInfo('weight', latestWeightData);
});

function convertISOStringToLocalString(isoString) {
    const date = new Date(isoString);
    const dateString = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\s/g, '');;

    const timeString = date.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });

    return `(${dateString} ${timeString})`;
}

function getLatestData(dataList, type) {
    const filtered = dataList.filter(d => d.device.type === type);

    let latest = null;

    for (const item of filtered) {
        if (!item.data || item.data.length === 0) continue; // 안전 가드
        const latestEntry = item.data[0]; // 시간 내림차순으로 정렬되어 있다고 가정
        if (!latest || new Date(latestEntry.time) > new Date(latest.time)) {
            latest = latestEntry;
        }
    }

    return latest;
}

function updateInfo(selector, data) {
    const valueElement = document.querySelector(`#${selector}-value`);
    const timeElement = document.querySelector(`#${selector}-time`);
    if (data) {
        valueElement.textContent = data.value;
        timeElement.textContent = convertISOStringToLocalString(data.time);
    } else {
        valueElement.textContent = 'N/A';
        timeElement.textContent = '';
    }
}