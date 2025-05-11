if (!window.BASE_PATH) {
    // 현재 URL이 포트를 포함하는지 확인
    const isPortPresent = !!window.location.port;
    // basePath 설정: 포트 포함 시 `/`, 없으면 `'/basePath/'` 포맷 유지
    const pathSegments = window.location.pathname.split('/').filter(Boolean); // 빈 요소 제거
    window.BASE_PATH = isPortPresent ? '/' : `/${pathSegments[0]}/`;
    console.log('Base path:', window.BASE_PATH);
}
