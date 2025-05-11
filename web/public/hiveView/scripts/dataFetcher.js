let fetcher_deviceList = [];
let fetcher_tRange = {sTime: null, eTime: null};
let fetcher_dataList = [];

async function fetchInOutData(deviceId, sTime, eTime) {
    const url = `${window.BASE_PATH}api/inout?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(`Data received for device ${deviceId}:`, data);
    return data;
}

async function fetchSensorData(deviceId, sTime, eTime) {
    const url = `${window.BASE_PATH}api/sensor?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(`Data received for device ${deviceId}:`, data);
    return data;
}

async function fetchDataList() {
    fetcher_dataList = [];
    let i = 0;
    for(const device of fetcher_deviceList) {
        let data;
        if(device.type_id == 2) {
            data = await fetchSensorData(device.id, fetcher_tRange.sTime, fetcher_tRange.eTime);

            // map 함수를 이용하여 data를 각각 'Temp', 'Humi', 'CO2', 'Weight'로 파싱하고 각 값과 시간을 분리하여 배열에 추가
            const tempData = data.map(d => ({id:d.id, value: d.temp, time: d.time}));
            const humiData = data.map(d => ({id:d.id, value: d.humi, time: d.time}));
            const co2Data = data.map(d => ({id:d.id, value: d.co2, time: d.time}));
            const weightData = data.map(d => ({id:d.id, value: d.weigh, time: d.time}));
            
            const tempDevice = {id: i++, type: 'Temp', hive_name: device.hive_name, name: device.name};
            const humiDevice = {id: i++, type: 'Humi', hive_name: device.hive_name, name: device.name};
            const co2Device = {id: i++, type: 'CO2', hive_name: device.hive_name, name: device.name};
            const weightDevice = {id: i++, type: 'Weight', hive_name: device.hive_name, name: device.name};

            fetcher_dataList.push({device: tempDevice, data: tempData});
            fetcher_dataList.push({device: humiDevice, data: humiData});
            fetcher_dataList.push({device: co2Device, data: co2Data});
            fetcher_dataList.push({device: weightDevice, data: weightData});
        } else if(device.type_id == 3) {
            data = await fetchInOutData(device.id, fetcher_tRange.sTime, fetcher_tRange.eTime);

            const inData = data.map(d => ({id:d.id, value: d.in_field, time: d.time}));
            const outData = data.map(d => ({id:d.id, value: d.out_field, time: d.time}));

            const inDevice = {id: i++, type: 'In', hive_name: device.hive_name, name: device.name};
            const outDevice = {id: i++, type: 'Out', hive_name: device.hive_name, name: device.name};

            fetcher_dataList.push({device: inDevice, data: inData});
            fetcher_dataList.push({device: outDevice, data: outData});
        }
    }

    const updateEvent = new CustomEvent('dataUpdated', { detail: fetcher_dataList });
    document.dispatchEvent(updateEvent);
}

// ================== 장치 선택기의 이벤트 리스너 ==================
document.addEventListener('deviceListUpdated', async (event) => {
    console.log('deviceListUpdated:', event.detail);

    fetcher_deviceList = event.detail;
    await fetchDataList();
});


// ================== 시간 선택기의 이벤트 리스너 ==================
document.addEventListener('timeRangeUpdated', async (event) => {
    console.log(`Time range updated: ${event.detail.sTime} ~ ${event.detail.eTime}`);
    fetcher_tRange = event.detail;
    if(fetcher_deviceList.length > 0) {
        await fetchDataList();
    }
});


// ================== latestInfo의 이벤트 리스너 ==================
document.addEventListener('dataUpdated', (event) => {
    console.log('dataLoaded:', fetcher_dataList);
    const dataList = event.detail;
    console.log('dataList:', dataList);

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
    const data = dataList.filter(d => d.device.type == type);
    const firstDevice = data[0];
    return firstDevice ? firstDevice.data[0] : null;
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