const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');
const session = require('express-session');
const passport = require('passport');
const loginRouter = require('./loginRoute'); // loginRoute.js 파일을 불러옴
const managementRouter = require('./managementRoute'); // 라우터 불러오기

const app = express();
const port = 8080;

const API_BASE_URL = 'http://api:8090';

//============== 기본 설정 ==============

// 프록시 설정
app.set('trust proxy', true);

//============== API 프록시 설정 (세션 및 Passport 미들웨어 이전) ==============

// Proxy API requests to the backend API without authentication
app.use('/api', createProxyMiddleware({
  target: API_BASE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '',  // ✅ '/api/login' → '/login'
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add original client IP to X-Forwarded-For header
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
    proxyReq.setHeader('X-Forwarded-For', clientIp);
  },
  onError: (err, req, res) => {
    console.error(`Error proxying request to ${API_BASE_URL}${req.originalUrl}:`, err.message);
    return res.status(500).send('Internal Server Error');
  }
}));

//============== 세션 및 Passport 설정 ==============

console.log('Session secret:', process.env.SESSION_SECRET);

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
  }
}));

// Passport 초기화 및 세션 사용 설정
app.use(passport.initialize());
app.use(passport.session());

//============== Body Parsing 미들웨어 추가 ==============

// Body parsing middleware 추가
app.use(express.json()); // JSON 요청 본문 파싱

//============== 정적 파일 서빙 ==============

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public'), { redirect: false }));
app.use('/picture', express.static('/app/db/picture'));

// // Serve Chart.js from node_modules
app.use('/chart.js', express.static(path.join(__dirname, 'node_modules/chart.js/dist')));
app.use('/chartjs-adapter-date-fns', express.static(path.join(__dirname, 'node_modules/chartjs-adapter-date-fns/dist')));

//============== 인증 미들웨어 ==============

// 인증 미들웨어 함수
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    let returnTo = '';
    let basePath = '';

    if (req.headers['x-original-url']) {
        returnTo = req.headers['x-original-url'];
        const segments = returnTo.split('/').slice(1);
        basePath = segments.length > 0 ? `/${segments[0]}` : '';
    } else {
        const referer = req.headers.referer || '';
        const segments = referer.split('/').slice(3);
        basePath = (segments.length > 1) ? `/${segments[0]}` : '';
        returnTo = basePath + req.originalUrl;
    }

    console.log('📌 basePath:', basePath || '(none)');
    console.log('📌 returnTo:', returnTo);

    const encodedReturnTo = encodeURIComponent(returnTo);
    res.redirect(`${basePath}/login?returnTo=${encodedReturnTo}`);
}

//============== 라우터 설정 ==============

// 인증이 필요한 라우트
app.get('/hiveView', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hiveView', 'hiveView.html'));
});

app.get('/compareView', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'compareView/compareView.html'));
});

// exportView 라우트 추가
app.get('/exportView', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'exportView/exportView.html'));
});

// pictureView 라우트 추가
app.get('/pictureView', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pictureView/pictureView.html'));
});

// 인증 없이 index.html 제공
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index2.html'));
});

// management 라우터 추가
app.use('/managementView', managementRouter(ensureAuthenticated));

// 로그인 라우터 추가
app.use('/', loginRouter);

//============== 서버 시작 ==============

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
