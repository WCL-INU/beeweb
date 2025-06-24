// 격자에 데이터를 동적으로 추가하는 함수
function loadPictures(pictures) {
    const gridContainer = document.getElementById('pictureGrid');
    const loadingIndicator = document.getElementById('loading-indicator');

    gridContainer.innerHTML = "";
    loadingIndicator.style.display = "block";  // 로딩 시작

    // 모든 이미지가 로딩 완료될 때까지 기다림
    const imagePromises = pictures.map(picture => {
        return new Promise(resolve => {
            const gridItem = document.createElement('div');
            gridItem.classList.add('grid-item');

            const img = document.createElement('img');
            img.src = picture.url;
            img.setAttribute('data-original', picture.url);

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
        }
        window.pictureViewer = new Viewer(gridContainer);
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