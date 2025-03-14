document.addEventListener('DOMContentLoaded', function () {
  // 서버로부터 로그인 상태 및 사용자 정보를 가져와 설정하는 함수
  function checkLoginStatus() {
    // 서버에서 사용자 정보를 가져오는 API 호출
    fetch('user-info')
      .then(response => response.json())
      .then(data => {
        if (data.userId) {
          // 로그인된 상태라면 사용자 ID와 로그아웃 버튼 표시
          showLoggedInUser(data.userId);
        } else {
          // 로그인되지 않은 상태라면 로그인 버튼 표시
          showLoginButton();
        }
      })
      .catch(error => console.error('Error fetching user info:', error));
  }

  // 로그인된 상태의 UI 표시 함수
  function showLoggedInUser(userId) {
    const userInfoDiv = document.querySelector('.user-info');
    userInfoDiv.innerHTML = `
        <span>ID: ${userId}</span> | 
        <button onclick="logout()">Logout</button>
      `;
  }

  // 페이지 로드 시 로그인 상태를 확인
  checkLoginStatus();
});

// 로그인되지 않은 상태의 UI 표시 함수
function showLoginButton() {
  const userInfoDiv = document.querySelector('.user-info');
  userInfoDiv.innerHTML = `
      <button onclick="window.location.href='login'">Login</button>
    `;
}

// 로그아웃 처리 함수
function logout() {
  fetch('logout', { method: 'GET' })
    .then(() => {
      showLoginButton(); // 로그아웃 후 로그인 버튼 표시
      window.location.href = 'login'; // 로그아웃 후 로그인 페이지로 이동
    })
    .catch(error => console.error('Error logging out:', error));
}