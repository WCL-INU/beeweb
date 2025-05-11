// Initialize the map
const localMap = window.map;

let currentMarker = null; // 현재 마커를 저장할 변수 추가

// OpenStreetMap 타일 추가
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(localMap);

// 드롭다운 토글 함수
function toggleDropdown(id) {
    document.getElementById(id).classList.toggle("show");
}

// 지역에 따라 지도를 업데이트하는 함수
function updateMap(regionId, regionName) {
    const regionCoordinates = {
        1: [37.375, 126.633], // 인천대
        2: [36.544, 128.8007] // 안동대
    };

    if (regionCoordinates[regionId]) {
        localMap.setView(regionCoordinates[regionId], 15);
        if (currentMarker) {
            localMap.removeLayer(currentMarker); // 기존 마커 제거
        }
        currentMarker = L.marker(regionCoordinates[regionId]).addTo(localMap)
            .bindPopup(regionName)
            .openPopup();
    }
}

// 하이브 목록을 업데이트하는 함수
function updateDropdownForHives(regionId, regionName, hives) {
    // 지도 업데이트
    updateMap(regionId, regionName);

    // 이전 드롭다운 내용 지우기
    let areaDropdown = document.getElementById('areaDropdown');
    areaDropdown.innerHTML = ''; // 기존 내용 제거

    hives.forEach(hive => {
        let button = document.createElement('button');
        button.textContent = hive.name;
        button.onclick = () => {
            // 하이브 선택 시 URL로 리디렉션
            window.location.href = `view?hiveId=${hive.id}`;
        };
        areaDropdown.appendChild(button);
    });

    // 업데이트된 드롭다운 보여주기
    areaDropdown.classList.add('show');
    document.getElementById('areaButton').innerText = 'Hive 선택';
}

// 초기 드롭다운으로 리셋하는 함수
function resetDropdown() {
    let areaDropdown = document.getElementById('areaDropdown');
    areaDropdown.innerHTML = '';
    document.getElementById('areaButton').innerText = '지역 선택';
    areaDropdown.classList.remove('show');
}

// 사용자가 드롭다운 외부를 클릭했을 때 드롭다운을 닫는 함수
window.onclick = function(event) {
    if (!event.target.matches('#areaButton')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

// 지역 및 하이브 데이터를 가져오는 함수
async function fetchAreaHiveData() {
    try {
        const response = await fetch('api/areahive');
        let data = await response.json();

        // 하이브 이름을 기준으로 정렬하고, 하이브가 없는 지역 제거
        data = data
            .filter(area => area.hives.length > 0) // 하이브가 있는 지역만 남김
            .map(area => {
                area.hives.sort((a, b) => {
                    const aNumber = parseInt(a.name.replace('Hive ', ''));
                    const bNumber = parseInt(b.name.replace('Hive ', ''));
                    return aNumber - bNumber;
                });
                return area;
            });

        return data;
    } catch (error) {
        console.error('Error fetching area and hive data:', error);
    }
}


// 드롭다운 메뉴를 업데이트하는 함수
async function updateDropdown() {
    const data = await fetchAreaHiveData();
    if (!data) return;

    let areaDropdown = document.getElementById('areaDropdown');
    areaDropdown.innerHTML = ''; // 기존 내용 제거

    data.forEach(region => {
        let regionButton = document.createElement('button');
        regionButton.textContent = region.name;
        regionButton.onclick = () => updateDropdownForHives(region.id, region.name, region.hives);
        areaDropdown.appendChild(regionButton);
    });

    document.getElementById('areaButton').innerText = '지역 선택';
}

// 페이지 로드 시 드롭다운 및 지도 설정
document.addEventListener('DOMContentLoaded', async () => {
    const data = await fetchAreaHiveData();
    if (!data) return;

    let hiveId = new URLSearchParams(window.location.search).get('hiveId');

    if (!hiveId) {
        // hiveId가 없으면 1로 설정
        hiveId = 1;
    }

    // URL에서 추출한 hiveId로 지도 설정
    data.forEach(region => {
        region.hives.forEach(hive => {
            if (hive.id == hiveId) {
                updateMap(region.id, region.name);
            }
        });
    });

    await updateDropdown();
});
