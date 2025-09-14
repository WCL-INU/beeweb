const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const axios = require('axios');
const path = require('path');

const router = express.Router();

const API_BASE_URL = 'http://api:8090'; // 이제 프록시된 경로로 접근

// Passport Local Strategy 설정
passport.use(new LocalStrategy({
      usernameField: 'id', // 기본 'username' 필드 대신 'id' 사용
      passwordField: 'pw'  // 기본 'password' 필드 대신 'pw' 사용
    },
    async (id, pw, done) => {
      try {
        const response = await axios.post(`${API_BASE_URL}/login`, { id, pw });
        if (response.data.success) {
          console.log('Login successful:', response.data.user);
          return done(null, response.data.user);
        } else {
          console.log('Login failed:', response.data.message);
          return done(null, false, { message: 'Invalid credentials' });
        }
      } catch (error) {
        console.error('Login API error:', error.response ? error.response.data : error.message);
        return done(error);
      }
    }
  ));  

// 사용자 세션 관리 - 웹 서버에서 세션 처리
passport.serializeUser((user, done) => {
  // 사용자의 id를 세션에 저장
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // 세션에서 저장한 id를 사용하여 사용자 정보를 API 서버에서 가져옵니다.
    const response = await axios.get(`${API_BASE_URL}/user/${id}`);
    done(null, response.data);
  } catch (error) {
    console.error('Login API error:', error.response ? error.response.data : error.message);
    done(error, null);
  }
});

// 로그인 페이지 라우트
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', '/account/login.html'));
});

// 로그인 요청 처리
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.log('Authentication error');
      return next(err);
    }
    if (!user) {
      console.log('Authentication failed');
      return res.redirect('login');
    }

    req.logIn(user, (err) => {
      if (err) {
        console.log('Login error:', err);
        return next(err);
      }

      // ✅ 최우선: 세션에 저장된 returnTo가 있으면 그걸로 이동
      const returnTo = req.session.returnTo;
      if (returnTo) {
        console.log('✅ Redirecting to returnTo:', returnTo);
        delete req.session.returnTo;
        return res.redirect(returnTo);
      }

      // ✅ fallback: referer에서 basePath 추출
      const referer = req.headers.referer || '';
      console.log('2Original URL:', referer);
      const segments = referer.split('/').slice(3);
      console.log('2Segments:', segments);
      const basePath = (segments.length > 1) ? `/${segments[0]}` : '/';
      console.log('2Base path:', basePath);

      return res.redirect(basePath);
    });
  })(req, res, next);
});

// 로그아웃 처리
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('login');
  });
});

// 사용자 정보 API 추가
router.get('/user-info', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ userId: req.user.id });
  } else {
    res.json({ userId: null });
  }
});

module.exports = router;
