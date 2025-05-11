// hive_list.js
let areaId = null;
let area_name = 'Unknown';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    areaId = urlParams.get('area_id');

    // 이름 출력하기
    area_name = await getAreaNameById(areaId); // 함수는 실제 데이터에 맞게 구현 필요
    // areaName이 Unknown이면 area목록으로 이동
    if (area_name === 'Unknown') {
        alert('존재하지 않는 AREA입니다.');
        window.location.href = `${window.BASE_PATH}managementView/area_list`;
    }

    const title = document.getElementById('hiveListTitle');
    title.textContent = `(${area_name}) : HIVE 관리`;

    // 추가 버튼 액션 등록
    document.getElementById('addHiveButton').onclick = () => {
        window.location.href = `${window.BASE_PATH}managementView/hive_add?area_id=${areaId}`;
    };

    let hives = await getHivesByAreaId(areaId); // 함수는 실제 데이터에 맞게 구현 필요
    console.log(hives);

    renderTable(hives);

    // 검색 버튼 클릭 시 검색 동작
    const searchBtn = document.getElementById('searchBtn');
    searchBtn.addEventListener('click', async () => {
        const searchQuery = document.getElementById('searchQuery').value.toLowerCase();
        const searchDropdown = document.getElementById('searchDropdown').value;

        const filteredHives = hives.filter(hive => {
            if (searchDropdown === 'id') {
                return hive.id.toString().includes(searchQuery);
            } else if (searchDropdown === 'name') {
                return hive.name.toLowerCase().includes(searchQuery);
            } 
        });

        renderTable(filteredHives);
    });

});

// 삭제 준비 함수
function prepareDelete(type, id) {
    // 삭제할 항목의 타입과 ID를 저장
    window.deleteType = type;
    window.deleteId = id;
    showDeleteModal();
}

async function getHivesByAreaId(id) {
    const response = await fetch(`${window.BASE_PATH}api/hive?areaId=${id}`);
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }

    let hives = [];
    data.forEach(hive => {
        hives.push({
            id: hive.id,
            name: hive.name,
            area_name: area_name
        });
    });

    return hives;
}

// area ID로 AREA 이름 가져오기
async function getAreaNameById(id) {
    const response = await fetch(`${window.BASE_PATH}api/area?areaId=${id}`);
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

// 삭제 확인 후 실행될 함수
document.addEventListener('modalLoaded', () => {
    const confirmButton = document.getElementById('confirmDelete');
    
    if (confirmButton) {
        confirmButton.addEventListener('click', async () => {
            const type = window.deleteType;
            const id = window.deleteId;

            if (type === 'hive') {

                await fetch(`${window.BASE_PATH}api/hive?hiveId=${id}`, { method: 'DELETE' })
                    .then(response => response.json())
                    .then(data => {
                        alert('HIVE가 삭제되었습니다.');
                        closeDeleteModal();
                        location.reload();
                    })
                    .catch(error => {
                        console.error('Error deleting HIVE:', error);
                        alert('HIVE 삭제에 실패했습니다.');
                    });

                closeDeleteModal();
                location.reload(); // 실제로는 테이블에서 해당 행을 제거하는 로직 필요
            }
        });
    }
});

// 테이블 렌더링 함수
function renderTable(hives) {
    const tableBody = document.querySelector('#hiveTable tbody');
    tableBody.innerHTML = ''; // 기존 데이터 초기화

    hives.forEach(hive => {
        const row = document.createElement('tr');

        // HIVE ID
        const idCell = document.createElement('td');
        idCell.textContent = hive.id;
        row.appendChild(idCell);

        // HIVE 이름 (링크)
        const nameCell = document.createElement('td');
        const link = document.createElement('a');
        link.href = `${window.BASE_PATH}managementView/device_list?hive_id=${hive.id}`;
        link.textContent = hive.name;
        nameCell.appendChild(link);
        row.appendChild(nameCell);

        // 지역 이름
        const areaCell = document.createElement('td');
        areaCell.textContent = hive.area_name;
        row.appendChild(areaCell);

        // 작업 버튼
        const actionsCell = document.createElement('td');
        actionsCell.classList.add('actions');

        const editButton = document.createElement('button');
        editButton.textContent = '수정';
        editButton.onclick = () => {
            window.location.href = `${window.BASE_PATH}managementView/hive_add?area_id=${areaId}&hive_id=${hive.id}`;
        };
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '삭제';
        deleteButton.classList.add('delete');
        deleteButton.onclick = () => {
            prepareDelete('hive', hive.id);
        };
        actionsCell.appendChild(deleteButton);

        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}