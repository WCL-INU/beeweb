// device_list.js
let hiveId = null;

document.addEventListener('DOMContentLoaded', async () => {
    
    const urlParams = new URLSearchParams(window.location.search);
    hiveId = urlParams.get('hive_id');
    const hive = await getHiveById(hiveId);
    if (!hive) {
        alert('존재하지 않는 HIVE입니다.');
        window.location.href = `${window.BASE_PATH}managementView`;
        // window.location.href = 'area_list.html';
    }

    const backlink = document.getElementById('back-link');
    backlink.href = `${window.BASE_PATH}managementView/hive_list?area_id=${hive.area_id}`;
    // backlink.href = `hive_list.html?area_id=${hive.area_id}`;

    const title = document.getElementById('deviceListTitle');
    title.textContent = `(${hive.name}) : DEVICE 관리`;

    // 추가 버튼 액션 등록
    document.getElementById('addDeviceButton').onclick = () => {
        window.location.href = `${window.BASE_PATH}managementView/device_add?hive_id=${hiveId}`;
        // window.location.href = `device_add.html?hive_id=${hiveId}`;
    };

    let devices = await getDevicesByHiveId(hiveId); // 함수는 실제 데이터에 맞게 구현 필요
    console.log(devices);

    renderTable(devices);

    // 검색 버튼 클릭 시 검색 동작
    const searchBtn = document.getElementById('searchBtn');
    searchBtn.addEventListener('click', async () => {
        const searchQuery = document.getElementById('searchQuery').value.toLowerCase();
        const searchDropdown = document.getElementById('searchDropdown').value;

        const filteredDevices = devices.filter(device => {
            if (searchDropdown === 'id') {
                return device.id.toString().includes(searchQuery);
            } else if (searchDropdown === 'name') {
                return device.name.toLowerCase().includes(searchQuery);
            } else if (searchDropdown === 'type') {
                return device.type.toLowerCase().includes(searchQuery);
            } else if (searchDropdown === 'ip') {
                return device.modem_ip.toLowerCase().includes(searchQuery);
            }
        });

        renderTable(filteredDevices);
    });
});

// 삭제 준비 함수
function prepareDelete(type, id) {
    // 삭제할 항목의 타입과 ID를 전역 변수로 설정
    window.deleteType = type;
    window.deleteId = id;
    showDeleteModal();  // 모달 표시
}

// area ID로 AREA 이름 가져오기
async function getAreaNameById(id) {
    const response = await fetch(`${window.BASE_PATH}api/area?areaId=${id}`);
    // const response = await fetch(`api/area?areaId=${id}`);
    const data = await response.json();

    // data가 존재하고 배열이 아닐 경우 처리
    if (!Array.isArray(data) || data.length === 0) {
        return 'Unknown';
    }

    // data 배열에서 id에 맞는 araea 찾기
    const area = data.find(area => area.id === parseInt(id));

    // area가 존재하고 name이 있으면 반환, 없으면 'Unknown'
    return area && area.name ? area.name : 'Unknown';
}

async function getDevicesByHiveId(id) {
    const url = `${window.BASE_PATH}api/device?hiveId=${id}`;
    // const url = `api/device?hiveId=${id}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }

    let devices = [];
    const types = await getDeviceTypes();
    data.forEach(device => {
        devices.push({
            id: device.id,
            name: device.name,
            type: types.find(type => type.id === device.type_id)?.name || 'UNKNOWN',
            modem_ip: device.modem_ip || '0.0.0.0'
        });
    });

    return devices;
}

async function getHiveById(id) {
    const url = `${window.BASE_PATH}api/hive?hiveId=${id}`;
    // const url = `api/hive?hiveId=${id}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }

    // data 배열에서 id에 맞는 hive 찾기
    const hive = data.find(hive => hive.id === parseInt(id));

    // hive가 존재하면 반환, 없으면 null
    return hive || hive.name ? hive : null;  
}

// 삭제 확인 후 실행될 함수
document.addEventListener('modalLoaded', () => {
    const confirmButton = document.getElementById('confirmDelete');

    if (confirmButton) {
        confirmButton.addEventListener('click', async () => {
            const type = window.deleteType;
            const id = window.deleteId;

            if (type === 'device') {
                await fetch(`${window.BASE_PATH}api/device?deviceId=${id}`, { method: 'DELETE' })
                // await fetch(`api/device?deviceId=${id}`, { method: 'DELETE' })
                    .then(response => response.json())
                    .then(data => {
                        alert('DEVICE가 삭제되었습니다.');
                        location.reload();
                    })
                    .catch(error => {
                        console.error('Error deleting DEVICE:', error);
                        alert('DEVICE 삭제에 실패했습니다.');
                    });

                closeDeleteModal();
                location.reload(); // 실제로는 테이블에서 해당 행을 제거하는 로직 필요
            }
        });
    }
});

function renderTable(devices) {
    const tableBody = document.querySelector('#deviceTable tbody');
    tableBody.innerHTML = ''; // 기존 데이터 초기화

    devices.forEach(device => {
        const row = document.createElement('tr');

        // 디바이스 ID
        const idCell = document.createElement('td');
        idCell.textContent = device.id;
        row.appendChild(idCell);

        // 디바이스 이름
        const nameCell = document.createElement('td');
        nameCell.textContent = device.name;
        row.appendChild(nameCell);

        // 타입
        const typeCell = document.createElement('td');
        typeCell.textContent = device.type;
        row.appendChild(typeCell);

        // 모뎀 IP
        const ipCell = document.createElement('td');
        ipCell.textContent = device.modem_ip;
        row.appendChild(ipCell);

        // 작업 버튼
        const actionsCell = document.createElement('td');
        actionsCell.classList.add('actions');

        const editButton = document.createElement('button');
        editButton.textContent = '수정';
        editButton.onclick = () => {
            window.location.href = `${window.BASE_PATH}managementView/device_add?hive_id=${hiveId}&device_id=${device.id}`;
            // window.location.href = `device_add.html?hive_id=${hiveId}&device_id=${device.id}`;
        };
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '삭제';
        deleteButton.classList.add('delete');
        deleteButton.onclick = () => {
            prepareDelete('device', device.id);
        };
        actionsCell.appendChild(deleteButton);

        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}

async function getDeviceTypes() {
    const url  = `${window.BASE_PATH}api/devicetypes`;
    // const url = 'api/devicetypes';
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }

    return data;
}