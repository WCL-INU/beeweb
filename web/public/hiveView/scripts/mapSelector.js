let currentMarker = null; // 현재 마커를 저장할 변수 추가

const localMap = L.map('map', {
    dragging: false, // 드래그 비활성화
    scrollWheelZoom: false, // 스크롤 휠 줌 비활성화
    doubleClickZoom: false, // 더블 클릭 줌 비활성화
    boxZoom: false, // 박스 줌 비활성화
    keyboard: false, // 키보드 제어 비활성화
}).setView([37.5665, 126.9780], 11); // Example coordinates (Seoul)

// Example marker (you can update coordinates as needed)
L.marker([37.5665, 126.9780]).addTo(localMap)
.bindPopup('Seoul')
.openPopup();

// OpenStreetMap 타일 추가
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(localMap);

// 지역에 따라 지도를 업데이트하는 함수
function updateMap(regionId, regionName) {
    // TODO : DB에서 가져온 값을 사용하도록 변경해야함
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

        console.log(`Map updated for region ${regionId}: ${regionName}`);
    }
}

// 이벤트 받아서 처리
document.addEventListener('areaUpdated', async (event) => {
    const {id, name} = event.detail;
    if(!id) { return; }
    updateMap(id, name);
});