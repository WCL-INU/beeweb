// 전역변수로 sTime, eTime 설정
let sTime;
let eTime;

// 이벤트 받아서 처리
document.addEventListener('saveButtonClicked', async (event) => {
    console.log('selected hive datas:', event.detail.hives);

    // 데이터 획득
    const hives = event.detail.hives;
    const datas = await getDatas(hives, sTime, eTime);
    saveHivesToExcel(datas);
});

// 이벤트 받아서 처리
document.addEventListener('timeRangeUpdated', (event) => {
    sTime = event.detail.sTime;
    eTime = event.detail.eTime;
    console.log(`Time range updated: ${sTime} ~ ${eTime}`);
});

// 실제 API 호출을 통해 HIVE 데이터를 가져오는 함수
async function getAreas() {
    const response = await fetch('api/areahive');
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }

    let hives = [];
    data.forEach(area => {
        area.hives.forEach(hive => {
            hives.push({
                id: hive.id,
                name: hive.name,
                area_name: area.name
            });
        });
    });
    return hives;
}

// data 구조
//  [hive {
//      device [{
//          inout {}
//          sensor {}
//      }]
//  }]
async function getDatas(hives, sTime, eTime) {
    // hives 배열을 깊은 복사하여 원본 보호
    const datas = hives.map(hive => ({ ...hive }));

    await Promise.all(datas.map(async hive => {
        const devices = await getDevices(hive.id);
        if (!devices || !devices.length) {
            hive.devices = []; // 빈 배열로 설정하여 undefined 방지
            return;
        }

        // 모든 `device`의 데이터 가져오기 (병렬 실행)
        await Promise.all(devices.map(async device => {
            if (device.type_id == 2) {
                device.sensor_data = await getSensor(device.id, sTime, eTime);
            } else if (device.type_id == 3) {
                device.inout_data = await getInout(device.id, sTime, eTime);
            }
        }));

        hive.devices = devices; // 최종 결과 반영
    }));

    return datas;
}

// 모든 data를 엑셀 폼으로 맵핑
// Time | 지역 ID | 지역 이름 | Hive ID | Hive 이름 | Device ID | Device 이름 | 
//                                  분류 | In Field | Out Field | Temperature | Humidity | CO2 | Weight  
function dataToExcelForm(datas) {
    let excelData = [];
    datas.forEach(hive => {
        hive.devices.forEach(device => {
            if (device.type_id == 2) {
                device.sensor_data.forEach(sensor => {
                    excelData.push({
                        'Time': sensor.time,
                        '지역 ID': hive.id,
                        '지역 이름': hive.area_name,
                        'Hive ID': hive.id,
                        'Hive 이름': hive.name,
                        'Device ID': device.id,
                        'Device 이름': device.name,
                        '분류': 'Sensor',
                        'In Field': '',
                        'Out Field': '',
                        'Temperature': sensor.temp,
                        'Humidity': sensor.humi,
                        'CO2': sensor.co2,
                        'Weight': sensor.weigh
                    });
                });
            } else if (device.type_id == 3) {
                device.inout_data.forEach(inout => {
                    excelData.push({
                        'Time': inout.time,
                        '지역 ID': hive.id,
                        '지역 이름': hive.area_name,
                        'Hive ID': hive.id,
                        'Hive 이름': hive.name,
                        'Device ID': device.id,
                        'Device 이름': device.name,
                        '분류': 'InOut',
                        'In Field': inout.in_field,
                        'Out Field': inout.out_field,
                        'Temperature': '',
                        'Humidity': '',
                        'CO2': '',
                        'Weight': ''
                    });
                });
            }
        });
    });
    return excelData;
}


async function getDevices(hiveId) {
    const response = await fetch(`api/device?hiveId=${hiveId}`);
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }

    return data;
}

async function getInout(deviceId, sTime, eTime) {
    const response = await fetch(`api/inout?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}`);
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }

    return data;
}

async function getSensor(deviceId, sTime, eTime) {
    const response = await fetch(`api/sensor?deviceId=${deviceId}&sTime=${sTime}&eTime=${eTime}`);
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }

    return data;
}

function saveHivesToExcel(data) {
    // 불러온 데이터를 엑셀 폼으로 변환
    const excelData = dataToExcelForm(data);
    
    // 4. 새로운 워크북 생성
    const wb = XLSX.utils.book_new();

    // 5. 워크시트 생성 (JSON 데이터를 시트로 변환)
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 6. 워크북에 워크시트 추가
    XLSX.utils.book_append_sheet(wb, ws, 'Hives');

    // 파일명에 시간범위 추가
    const sTimeStr = sTime.replace(/:/g, '-');
    const eTimeStr = eTime.replace(/:/g, '-');
    const fileName = `hive_data_${sTimeStr}~${eTimeStr}.xlsx`;

    // 7. 엑셀 파일 다운로드
    XLSX.writeFile(wb, fileName);
}
