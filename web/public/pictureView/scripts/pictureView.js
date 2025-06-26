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

    Promise.all(imagePromises)
    .then(() => {
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
                zoomIn: 1,
                zoomOut: 1,
                oneToOne: 0,
                reset: 1,
                prev: 1,
                play: { show: 0 },
                next: 1,
                rotateLeft: 1,
                rotateRight: 1,
                flipHorizontal: 0,
                flipVertical: 0
            },
            url(image) {
                return image.dataset.original;
            }
        });
    })
    .catch(error => {
        console.error('이미지 로딩 중 에러 발생:', error);
    })
    .finally(() => {
        document.dispatchEvent(new Event('loadingEnd')); // ✅ 로딩 종료 알림은 무조건 실행
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