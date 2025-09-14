// 기존 inout/sensor API 제거, sensor2 기반으로 통합
let fetcher_deviceList = [];
let fetcher_tRange = { sTime: null, eTime: null };
let fetcher_dataList = [];

async function fetchSensor2Data(deviceId, sTime, eTime, dataTypes) {
    const typeStr = dataTypes.join(',');
    const url = `${window.BASE_PATH}api/data/sensor2?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}&dataTypes=${typeStr}`;
    const response = await fetch(url);

    if (!response.ok) {
        console.warn(`No data for device ${deviceId} (status: ${response.status})`);
        return [];
    }

    const data = await response.json();
    console.log(`[DataFetcher] ${data.length} data points received for device ${deviceId} (${sTime} ~ ${eTime})`, data);
    return data;
}

async function fetchDataList() {
    fetcher_dataList = [];
    let i = 0;

    for (const device of fetcher_deviceList) {
        let dataTypes = [];
        let typeMap = {};

        if (device.type_id === 2) {
            dataTypes = [4, 5, 6, 7]; // TEMP, HUMI, CO2, WEIGH
            typeMap = {
                4: "Temp",
                5: "Humi",
                6: "CO2",
                7: "Weight"
            };
        } else if (device.type_id === 3) {
            dataTypes = [2, 3]; // IN, OUT
            typeMap = {
                2: "In",
                3: "Out"
            };
        } else {
            continue; // type_id가 2 또는 3이 아니면 무시
        }

        const data = await fetchSensor2Data(
            device.id,
            fetcher_tRange.sTime,
            fetcher_tRange.eTime,
            dataTypes
        );

        for (const typeId of dataTypes) {
            const label = typeMap[typeId];
            const parsed = data
                .filter(d => d.data_type === typeId)
                .map(d => ({
                    id: d.id,
                    value: d.value,
                    time: d.time
                }));

            const deviceMeta = {
                id: i++,
                type: label,
                hive_name: device.hive_name,
                name: device.name
            };

            fetcher_dataList.push({ device: deviceMeta, data: parsed });
        }
    }

    const updateEvent = new CustomEvent("dataUpdated", {
        detail: fetcher_dataList
    });
    document.dispatchEvent(updateEvent);
}

// ================== 장치 선택기의 이벤트 리스너 ==================
document.addEventListener("deviceListUpdated", async (event) => {
    console.log("[DataFetcher] deviceListUpdated:", event.detail);

    fetcher_deviceList = event.detail;
    await fetchDataList();
});

// ================== 시간 선택기의 이벤트 리스너 ==================
document.addEventListener("timeRangeUpdated", async (event) => {
    console.log(`[DataFetcher] Time range updated: ${event.detail.sTime} ~ ${event.detail.eTime}`);
    fetcher_tRange = event.detail;
    if (fetcher_deviceList.length > 0) {
        await fetchDataList();
    }
});
