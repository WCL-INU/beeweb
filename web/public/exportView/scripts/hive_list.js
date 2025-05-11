document.addEventListener('DOMContentLoaded', async () => {
    let hives = await getAreas();

    const tableBody = document.querySelector('#hiveTable tbody');
    renderTable(hives);

    // 검색 버튼 클릭 시 검색 동작
    const searchBtn = document.getElementById('searchBtn');
    searchBtn.addEventListener('click', () => {
        const searchQuery = document.getElementById('searchQuery').value.toLowerCase();
        const searchDropdown = document.getElementById('searchDropdown').value;

        const filteredHives = hives.filter(hive => {
            if (searchDropdown === 'id') {
                return hive.id.toString().includes(searchQuery);
            } else if (searchDropdown === 'name') {
                return hive.name.toLowerCase().includes(searchQuery);
            } else if (searchDropdown === 'region') {
                return hive.area_name.toLowerCase().includes(searchQuery);
            }
        });

        renderTable(filteredHives);
    });

    // 전체 선택 체크박스 동작
    const selectAllCheckbox = document.getElementById('selectAll');
    selectAllCheckbox.addEventListener('click', toggleSelectAll);

    // 저장 버튼 클릭 시 저장 동작 호출
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.addEventListener('click', saveSelectedHives);
});

// 테이블 렌더링 함수
function renderTable(hives) {
    const tableBody = document.querySelector('#hiveTable tbody');
    tableBody.innerHTML = ''; // 기존 데이터 초기화

    hives.forEach(hive => {
        const row = document.createElement('tr');

        // 선택 체크박스
        const selectCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('selectItem');
        selectCell.appendChild(checkbox);
        row.appendChild(selectCell);

        // HIVE ID
        const idCell = document.createElement('td');
        idCell.textContent = hive.id;
        row.appendChild(idCell);

        // HIVE 이름 (링크)
        const nameCell = document.createElement('td');
        nameCell.textContent = hive.name;
        row.appendChild(nameCell);

        // 지역 이름
        const areaCell = document.createElement('td');
        areaCell.textContent = hive.area_name;
        row.appendChild(areaCell);

        tableBody.appendChild(row);
    });
}

// 전체 선택 체크박스 토글
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.selectItem');
    const selectAll = document.getElementById('selectAll').checked;

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll;
    });
}

// 선택된 HIVE 저장 함수 (구현은 별도 파일에서)
function saveSelectedHives() {
    const selectedHives = [];
    const checkboxes = document.querySelectorAll('.selectItem');
    checkboxes.forEach((checkbox, index) => {
        if (checkbox.checked) {
            const row = checkbox.closest('tr');
            const hiveId = row.cells[1].textContent;
            const hiveName = row.cells[2].textContent;
            const areaName = row.cells[3].textContent;
            selectedHives.push({
                id: hiveId,
                name: hiveName,
                area_name: areaName
            });
        }
    });

    // // 저장 동작을 별도의 함수로 호출
    // saveHivesToFile(selectedHives);

    // 저장 동작을 이벤트로 호출
    // 저장 버튼 클릭시 이벤트 발생
    const saveEvent = new CustomEvent('saveButtonClicked', { detail: { hives: selectedHives } });
    document.dispatchEvent(saveEvent);
}

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