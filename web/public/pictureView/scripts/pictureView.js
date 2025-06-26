// 격자에 데이터를 동적으로 추가하는 함수
function loadPictures(pictures) {
    const gridContainer = document.getElementById('pictureGrid');
    const loadingIndicator = document.getElementById('loading-indicator');

    gridContainer.innerHTML = "";
    loadingIndicator.style.display = "block";  // 로딩 시작

    pictures.sort((a, b) => new Date(a.time) - new Date(b.time));
    
    // 모든 이미지가 로딩 완료될 때까지 기다림
    const imagePromises = pictures.map(picture => {
        return new Promise(resolve => {
            const gridItem = document.createElement('div');
            gridItem.classList.add('grid-item');

            const img = document.createElement('img');
            img.src = picture.thumbUrl; // ✅ 썸네일로 보이기
            img.setAttribute('data-original', picture.fullUrl); // ✅ Viewer가 원본 이미지 로딩

            img.onload = () => resolve();  // 개별 이미지 로딩 완료
            img.onerror = () => resolve(); // 실패해도 그냥 resolve

            const timestamp = document.createElement('div');
            timestamp.classList.add('timestamp');
            timestamp.innerText = picture.time;

            gridItem.appendChild(img);
            gridItem.appendChild(timestamp);
            gridContainer.appendChild(gridItem);
        });
    });

    Promise.all(imagePromises).then(() => {
        document.dispatchEvent(new Event('loadingEnd'));  // 로딩 종료 알림

        if (window.pictureViewer) {
            window.pictureViewer.destroy();
            window.pictureViewer = null;
        }

        window.pictureViewer = new Viewer(gridContainer, {
            inline: false,
            button: true,
            navbar: false,
            title: true,
            movable: false,
            toolbar: {
                zoomIn: 1,  // 확대 버튼
                zoomOut: 1, // 축소 버튼
                oneToOne: 0,    // 원본 크기로 보기 버튼
                reset: 1,   // 초기화 버튼
                prev: 1,    // 이전 이미지 버튼
                play: { show: 0 },  // 슬라이드 쇼 버튼 숨김
                next: 1,    // 다음 이미지 버튼
                rotateLeft: 1,  // 왼쪽으로 회전 버튼
                rotateRight: 1, // 오른쪽으로 회전 버튼
                flipHorizontal: 0,  // 수평 뒤집기 버튼 숨김
                flipVertical: 0 // 수직 뒤집기 버튼 숨김
            },
            url(image) {
                return image.dataset.original; // 👈 원본 경로를 지정
            }
        });
    });
}

// 이벤트 받아서 처리
document.addEventListener('dataUpdated', (event) => {
    console.log('dataUpdated:', event.detail);
    loadPictures(event.detail);
});

// 로딩 인디케이터 표시 제어
const loadingIndicator = document.getElementById('loading-indicator');
const loadingOverlay = document.getElementById('loading-overlay');

document.addEventListener('loadingStart', () => {
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (loadingIndicator) loadingIndicator.style.display = 'block';
});

document.addEventListener('loadingEnd', () => {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'none';
});