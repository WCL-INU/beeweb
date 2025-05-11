// device_add.js
document.addEventListener('DOMContentLoaded', async () => {

    // select box에 deviceType 목록 추가
    const deviceTypes = await getDeviceTypes();
    const deviceTypeSelect = document.getElementById('deviceType');
    deviceTypeSelect.innerHTML = '';
    deviceTypes.forEach(deviceType => {
        const option = document.createElement('option');
        option.value = deviceType.id;
        option.textContent = deviceType.name;
        deviceTypeSelect.appendChild(option);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const hiveId = urlParams.get('hive_id');
    const deviceId = urlParams.get('device_id'); // 수정 시 사용

    const title = document.getElementById('deviceAddTitle');
    const hive_name = await getHiveNameById(hiveId);

    if (deviceId) {
        title.textContent = `(${hive_name}) : DEVICE 수정`;
    
        // 수정할때 deviceType 수정 불가
        document.getElementById('deviceType').disabled = true;

        // 예시 데이터
        document.getElementById('deviceName').value = 'Example Device';
        document.getElementById('deviceType').value = '1';
    
        // 기존 Device 데이터 로드 (API 호출 필요)
        const device = await getDeviceById(deviceId);
        if (device) {
            document.getElementById('deviceName').value = device.name;
            document.getElementById('deviceType').value = device.type_id;
        } else {
            alert('존재하지 않는 DEVICE입니다.');
            window.location.href = `${window.BASE_PATH}managementView/device_list?hive_id=${hiveId}`;
            // window.location.href = `device_list.html?hive_id=${hiveId}`;
        }
    } else {
        title.textContent = `(${hive_name}) : DEVICE 추가`;
    }

    const form = document.getElementById('deviceAddForm');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const deviceName = document.getElementById('deviceName').value.trim();
        const deviceType = document.getElementById('deviceType').value;

        if (deviceName === '' || deviceType === '') {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        if (deviceId) {
            await fetch(`${window.BASE_PATH}api/device`, {
            // await fetch('api/device', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: deviceId, name: deviceName })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Device updated successfully') {
                        alert('DEVICE가 수정되었습니다.');
                        window.location.href = `${window.BASE_PATH}managementView/device_list?hive_id=${hiveId}`;
                        // window.location.href = `device_list.html?hive_id=${hiveId}`;
                    } else if (data.message === 'Device not found') {
                        alert('존재하지 않는 DEVICE입니다.');
                    }
                })
                .catch(error => {
                    console.error('Error updating DEVICE:', error);
                    alert('DEVICE 수정에 실패했습니다.');
                });
            window.location.href = `${window.BASE_PATH}managementView/device_list?hive_id=${hiveId}`;
            // window.location.href = `device_list.html?hive_id=${hiveId}`;
        } else {
            await fetch(`${window.BASE_PATH}api/device`, {
            // await fetch('api/device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: deviceName, hiveId: hiveId, typeId: deviceType })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Device added successfully') {
                        alert('DEVICE가 추가되었습니다.');
                        window.location.href = `${window.BASE_PATH}managementView/device_list?hive_id=${hiveId}`;
                        // window.location.href = `device_list.html?hive_id=${hiveId}`;
                    } else if (data.message === 'Device already exists') {
                        alert('이미 존재하는 DEVICE입니다.');
                    }
                })
                .catch(error => {
                    console.error('Error adding DEVICE:', error);
                    alert('DEVICE 추가에 실패했습니다.');
                });
            window.location.href = `${window.BASE_PATH}managementView/device_list?hive_id=${hiveId}`;
            // window.location.href = `device_list.html?hive_id=${hiveId}`;
        }
    });
});

// HIVE ID로 HIVE 이름 가져오기 (예시 함수)
async function getHiveNameById(id) {
    const url = `${window.BASE_PATH}api/hive?hiveId=${id}`;
    // const url = `api/hive?hiveId=${id}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // data가 존재하고 배열이 아닐 경우 처리
    if (!Array.isArray(data) || data.length === 0) {
        return 'Unknown';
    }

    // data 배열에서 id에 맞는 hive 찾기
    const hive = data.find(hive => hive.id === parseInt(id));

    // hive가 존재하고 name이 있으면 반환, 없으면 'Unknown'
    return hive && hive.name ? hive.name : 'Unknown';
}

async function getDeviceById(id) {
    const url = `${window.BASE_PATH}api/device?deviceId=${id}`;
    // const url = `api/device?deviceId=${id}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }

    // data 배열에서 id에 맞는 device 찾기
    const device = data.find(device => device.id === parseInt(id));

    // device가 존재하면 반환, 없으면 null
    return device && device.name ? device : null;
}

async function getDeviceTypes() {
    const url = `${window.BASE_PATH}api/devicetypes`;
    // const url = 'api/devicetypes';
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }

    return data;
}