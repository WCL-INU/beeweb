// public/js/modal.js
document.addEventListener('DOMContentLoaded', () => {
    if (!window.BASE_PATH) {
        // 현재 URL이 포트를 포함하는지 확인
        const isPortPresent = !!window.location.port;
        // basePath 설정: 포트 포함 시 `/`, 없으면 `'/basePath/'` 포맷 유지
        const pathSegments = window.location.pathname.split('/').filter(Boolean); // 빈 요소 제거
        window.BASE_PATH = isPortPresent ? '/' : `/${pathSegments[0]}/`;
        console.log('Base path:', window.BASE_PATH);
    }
    
    fetch(`${window.BASE_PATH}managementView/modal`)
        .then(response => response.text())
        .then(data => {
            document.getElementById('modal').innerHTML = data;

            // 모달 제어
            const modal = document.getElementById('deleteModal');
            const closeButton = document.querySelector('.close-button');
            const cancelButton = document.getElementById('cancelDelete');
            const confirmButton = document.getElementById('confirmDelete');

            closeButton.addEventListener('click', () => {
                modal.style.display = 'none';
            });

            cancelButton.addEventListener('click', () => {
                modal.style.display = 'none';
            });

            // 전역 함수 설정
            window.showDeleteModal = () => {
                modal.style.display = 'block';
            };

            window.closeDeleteModal = () => {
                modal.style.display = 'none';
            };

            // 커스텀 이벤트 발생 - 모달이 로드되었음을 알림
            document.dispatchEvent(new Event('modalLoaded'));
        })
        .catch(error => console.error('Error loading modal:', error));
});
