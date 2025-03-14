const express = require('express');
const path = require('path');

const router = express.Router();

// HTML 파일 목록 (없으면 기본 area_list.html을 서빙)
const validPages = [
    'area_add', 'area_list',
    'device_add', 'device_list',
    'hive_add', 'hive_list'
];

// /managementView/:page 처리
router.get('/:page?', (req, res) => {
    const page = req.params.page || 'area_list'; // 기본값: area_list
    const fileName = `${page}.html`;

    if (!validPages.includes(page)) {
        return res.sendFile(path.join(__dirname, '..', 'public', 'managementView', 'area_list.html'));
    }

    res.sendFile(path.join(__dirname, '..', 'public', 'managementView', fileName));
});

module.exports = router;
