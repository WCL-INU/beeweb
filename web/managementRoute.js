const express = require('express');
const path = require('path');

module.exports = (ensureAuthenticated) => {
    const router = express.Router();

    // ✅ 인증 적용
    router.use(ensureAuthenticated);

    // HTML 파일 목록 (없으면 기본 area_list.html을 서빙)
    const validPages = [
        'area_add', 'area_list',
        'device_add', 'device_list',
        'hive_add', 'hive_list',
        'modal', 'navbar'
    ];

    // ✅ `/managementView/:page` 라우트 처리
    router.get('/:page?', (req, res) => {
        const page = req.params.page || 'area_list';

        // 파일 경로 설정
        const filePath = path.join(__dirname, 'public', 'managementView', `${page}.html`);

        if (!validPages.includes(page)) {
            return res.redirect(`/managementView${req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''}`);
        }
        
        // ✅ 쿼리 스트링을 유지한 채 HTML 반환
        res.sendFile(filePath);
    });

    return router;
};
