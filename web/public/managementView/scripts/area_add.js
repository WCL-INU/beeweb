// public/js/area_add.js
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const areaId = urlParams.get('area_id');

    const title = document.getElementById('areaAddTitle');

    if (areaId) {
        title.textContent = 'AREA 수정';

        // 예시 데이터
        document.getElementById('areaName').value = 'Example Area';
        document.getElementById('areaLocation').value = '0, 0';

        // 기존 Area 데이터 로드 (API 호출 필요)
        const area = await getAreaById(areaId);
        if (area) {
            document.getElementById('areaName').value = area.name;
            document.getElementById('areaLocation').value = area.location;
        } else {
            alert('존재하지 않는 AREA입니다.');
            window.location.href = `${window.BASE_PATH}managementView`;
        }
    } else {
        title.textContent = 'AREA 추가';
    }

    const form = document.getElementById('areaAddForm');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const areaName = document.getElementById('areaName').value.trim();
        const areaLocation = document.getElementById('areaLocation').value.trim();
        if (areaName === '') {
            alert('지역 이름을 입력해주세요.');
            return;
        }

        if (areaId) {
            await fetch(`${window.BASE_PATH}api/area`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ areaId: areaId, name: areaName, location: areaLocation })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Area updated successfully') {
                        alert('AREA가 수정되었습니다.');
                        window.location.href = `${window.BASE_PATH}managementView`;
                    } else if (data.message === 'Area not found') {
                        alert('존재하지 않는 AREA입니다.');
                    }
                })
                .catch(error => {
                    console.error('Error updating AREA:', error);
                    alert('AREA 수정에 실패했습니다.');
                });
            return;
        } else {
            await fetch(`${window.BASE_PATH}api/area`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: areaName, location: areaLocation })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Area created successfully') {
                        alert('AREA가 추가되었습니다.');
                        window.location.href = `${window.BASE_PATH}managementView`;
                    }
                })
                .catch(error => {
                    console.error('Error adding AREA:', error);
                    alert('AREA 추가에 실패했습니다.');
                });
            window.location.href = `${window.BASE_PATH}managementView`;
        }
    });
});

async function getAreaById(areaId) {
    const response = await fetch(`${window.BASE_PATH}api/area?areaId=${areaId}`);
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }
    
    console.log(data);
    // data 배열에서 id에 맞는 area 찾기
    const area = data.find(area => area.id === parseInt(areaId));

    // area가 존재하면 반환, 없으면 null
    return area || area.name ? area : null;
}