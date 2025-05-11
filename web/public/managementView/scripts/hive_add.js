// public/js/hive_add.js
document.addEventListener('DOMContentLoaded', async () => {

    // select box에 지역 목록 추가
    const areas = await getAreas();
    const areaSelect = document.getElementById('areaSelect');
    areaSelect.innerHTML = '';
    areas.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        areaSelect.appendChild(option);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const areaId = urlParams.get('area_id');
    const hiveId = urlParams.get('hive_id'); // 수정 시 사용

    const title = document.getElementById('hiveAddTitle');
    const area_name = await getAreaNameById(areaId);

    // 취소 버튼 액션 등록
    document.getElementById('cancelButton').onclick = () => {
        window.location.href = `${window.BASE_PATH}managementView/hive_list?area_id=${areaId}`;
        // window.location.href = `hive_list.html?area_id=${areaId}`;
    };


    if (hiveId) {
        title.textContent = `(${area_name}) : HIVE 수정`;

        // 예시 데이터
        document.getElementById('hiveName').value = 'Example Hive';
        document.getElementById('areaSelect').value = '1';

        // 기존 Hive 데이터 로드 (API 호출 필요)
        const hive = await getHiveById(hiveId);
        if (hive) {
            document.getElementById('hiveName').value = hive.name;
            document.getElementById('areaSelect').value = hive.area_id;
        } else {
            alert('존재하지 않는 HIVE입니다.');
            window.location.href = `${window.BASE_PATH}managementView/hive_list?area_id=${areaId}`;
            // window.location.href = `hive_list.html?area_id=${areaId}`;
        }
    } else {
        title.textContent = `(${area_name}) : HIVE 추가`;
        document.getElementById('areaSelect').value = areaId;
    }

    const form = document.getElementById('hiveAddForm');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const hiveName = document.getElementById('hiveName').value.trim();
        const areaId = document.getElementById('areaSelect').value;

        if (hiveName === '' || areaId === '') {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        if (hiveId) {
            await fetch(`${window.BASE_PATH}api/hive`, {
            // await fetch('api/hive', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hiveId: hiveId, name: hiveName, areaId: areaId })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Hive updated successfully') {
                        alert('HIVE가 수정되었습니다.');
                        window.location.href = `hive_list.html?area_id=${areaId}`;
                    } else if (data.message === 'Hive not found') {
                        alert('존재하지 않는 HIVE입니다.');
                    }
                })
                .catch(error => {
                    console.error('Error updating HIVE:', error);
                    alert('HIVE 수정에 실패했습니다.');
                });
            return;
        } else {
            await fetch(`${window.BASE_PATH}api/hive`, {
            // await fetch('api/hive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: hiveName, areaId: areaId })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Hive added successfully') {
                        alert('HIVE가 추가되었습니다.');
                        window.location.href = `hive_list.html?area_id=${areaId}`;
                    } else if (data.message === 'Hive already exists') {
                        alert('이미 존재하는 HIVE입니다.');
                    }
                })
                .catch(error => {
                    console.error('Error adding HIVE:', error);
                    alert('HIVE 추가에 실패했습니다.');
                });
            window.location.href = `hive_list.html?area_id=${areaId}`;
        }
    });
});

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

async function getHiveById(id) {
    const url = `${window.BASE_PATH}api/hive?hiveId=${id}`;
    // const url = `api/hive?hiveId=${id}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }

    // data 배열에서 id에 맞는 hive 찾기
    const hive = data.find(hive => hive.id === parseInt(id));

    // hive가 존재하면 반환, 없으면 null
    return hive || hive.name ? hive : null;
}

async function getAreas() {
    const response = await fetch(`${window.BASE_PATH}api/area`);
    // const response = await fetch('api/area');
    const data = await response.json();

    if (!data || !data.length) {
        return [];
    }

    let areas = [];
    data.forEach(area => {
        areas.push({
            id: area.id,
            name: area.name
        });
    });

    return areas;
}