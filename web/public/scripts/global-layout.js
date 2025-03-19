document.addEventListener('DOMContentLoaded', function () {
  if (!window.BASE_PATH) {
    // 현재 URL이 포트를 포함하는지 확인
    const isPortPresent = !!window.location.port;
    // basePath 설정: 포트 포함 시 `/`, 없으면 `'/basePath/'` 포맷 유지
    const pathSegments = window.location.pathname.split('/').filter(Boolean); // 빈 요소 제거
    window.BASE_PATH = isPortPresent ? '/' : `/${pathSegments[0]}/`;
    console.log('Base path:', window.BASE_PATH);
  }

    // header
    const globalHeader = document.getElementById('global-header');
    globalHeader.innerHTML = `
      <button onclick="window.location.href='${window.BASE_PATH}'">Home</button>
      <div class="user-info"></div>
    `;
    // footer
    const globalFooter = document.getElementById('global-footer');
    globalFooter.innerHTML = `
      <p>Wireless Communication LAB, Dept of Embedded System Engineering, Incheon National University</p>
    `;

  // ✅ 로그인 상태 확인
  function checkLoginStatus() {
    fetch(`${window.BASE_PATH}user-info`)
      .then(response => response.json())
      .then(data => {
        if (data.userId) {
          showLoggedInUser(data.userId);
        } else {
          showLoginButton();
        }
      })
      .catch(error => console.error('Error fetching user info:', error));
  }

  // ✅ 로그인된 상태 UI 표시
  function showLoggedInUser(userId) {
    const userInfoDiv = globalHeader.querySelector('.user-info');
    userInfoDiv.innerHTML = `
        <span>ID: ${userId}</span> | 
        <button onclick="window.location.href='${window.BASE_PATH}logout'">Logout</button>
      `;
  }

  // ✅ 로그인되지 않은 상태 UI 표시
  function showLoginButton() {
    const userInfoDiv = globalHeader.querySelector('.user-info');
    userInfoDiv.innerHTML = `
        <button onclick="window.location.href='${window.BASE_PATH}login'">Login</button>
      `;
  }
  
  // ✅ 로그인 상태 확인 실행
  checkLoginStatus();
});
