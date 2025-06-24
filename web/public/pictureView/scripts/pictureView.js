// 격자에 데이터를 동적으로 추가하는 함수
function loadPictures(pictures) {
    const gridContainer = document.getElementById('pictureGrid');
    gridContainer.innerHTML = "";  // 기존 데이터 초기화

    pictures.forEach(picture => {
        const gridItem = document.createElement('div');
        gridItem.classList.add('grid-item');

        const img = document.createElement('img');
        img.src = picture.url;
        img.setAttribute('data-original', picture.url);  // Viewer.js를 위한 속성

        const timestamp = document.createElement('div');
        timestamp.classList.add('timestamp');
        timestamp.innerText = picture.time;

        gridItem.appendChild(img);
        gridItem.appendChild(timestamp);
        gridContainer.appendChild(gridItem);
    });

    // Viewer.js 초기화
    if (window.pictureViewer) {
        window.pictureViewer.destroy();
    }
    window.pictureViewer = new Viewer(gridContainer, {
        navbar: false,
        title: true,
        toolbar: {
            zoomIn: 1,
            zoomOut: 1,
            reset: 1,
            prev: 1,
            play: {
                show: 0,
            },
            next: 1,
            rotateLeft: 1,
            rotateRight: 1,
            flipHorizontal: 1,
            flipVertical: 1,
        },
    });
}

// 이벤트 받아서 처리
document.addEventListener('dataUpdated', (event) => {
    console.log('dataUpdated:', event.detail);
    loadPictures(event.detail);
});