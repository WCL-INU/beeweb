// area_list.js
document.addEventListener('DOMContentLoaded', async () => {
    let areas = await getAreas();
    renderTable(areas);

    // 검색 버튼 클릭 시 검색 동작
    const searchBtn = document.getElementById('searchBtn');
    searchBtn.addEventListener('click', async () => {
        const searchQuery = document.getElementById('searchQuery').value.toLowerCase();
        const searchDropdown = document.getElementById('searchDropdown').value;

        const filteredAreas = areas.filter(area => {
            if (searchDropdown === 'id') {
                return area.id.toString().includes(searchQuery);
            } else if (searchDropdown === 'name') {
                return area.name.toLowerCase().includes(searchQuery);
            } 
        });

        renderTable(filteredAreas);
    });
});

async function getAreas() {
    const response = await fetch(`${window.BASE_PATH}api/area`);
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }
    console.log(data);
    let areas = [];
    data.forEach(area => {
        areas.push({
            id: area.id,
            name: area.name,
            location: area.location
        });
    });

    return areas;
}

// 삭제 준비 함수
function prepareDelete(type, id) {
    // 삭제할 항목의 타입과 ID를 저장
    window.deleteType = type;
    window.deleteId = id;
    showDeleteModal();
}

// 테이블 렌더링 함수
function renderTable(areas) {
    const tableBody = document.querySelector('#areaTable tbody');
    tableBody.innerHTML = ''; // 기존 데이터 초기화

    areas.forEach(area => {
        const row = document.createElement('tr');

        // 지역 ID
        const idCell = document.createElement('td');
        idCell.textContent = area.id;
        row.appendChild(idCell);

        // 지역 이름 (링크)
        const nameCell = document.createElement('td');
        const link = document.createElement('a');
        link.href = `${window.BASE_PATH}managementView/hive_list?area_id=${area.id}`;
        link.textContent = area.name;
        nameCell.appendChild(link);
        row.appendChild(nameCell);

        // 위치
        const locationCell = document.createElement('td');
        locationCell.textContent = area.location;
        row.appendChild(locationCell);

        // 작업 버튼
        const actionsCell = document.createElement('td');
        actionsCell.classList.add('actions');
        
        const editButton = document.createElement('button');
        editButton.textContent = '수정';
        editButton.onclick = () => {
            window.location.href = `${window.BASE_PATH}managementView/area_add?area_id=${area.id}`;
        };
        actionsCell.appendChild(editButton);
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '삭제';
        deleteButton.classList.add('delete');
        deleteButton.onclick = () => {
            prepareDelete('area', area.id);
        };
        actionsCell.appendChild(deleteButton);

        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}


document.addEventListener('modalLoaded', () => {
    const confirmButton = document.getElementById('confirmDelete');
    
    if (confirmButton) {
        confirmButton.addEventListener('click', async () => {
            const type = window.deleteType;
            const id = window.deleteId;

            if (type === 'area') {
                await fetch(`${window.BASE_PATH}api/area?areaId=${id}`, { method: 'DELETE' })
                    .then(response => response.json())
                    .then(data => {
                        alert('AREA가 삭제되었습니다.');
                        closeDeleteModal();
                        location.reload();
                    })
                    .catch(error => {
                        console.error('Error deleting AREA:', error);
                        alert('AREA 삭제에 실패했습니다.');
                    });
            }
        });
    }
});