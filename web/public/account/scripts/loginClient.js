document.addEventListener('DOMContentLoaded', function () {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const returnTo = urlParams.get('returnTo');
    if (error) {
        document.getElementById('error-message').textContent = 'Invalid credentials. Please try again.';
    }

    // returnTo을 hidden input에 저장 (폼 submit 대비용)
    if (returnTo) {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'returnTo';
        hiddenInput.value = returnTo;
        document.getElementById('loginForm').appendChild(hiddenInput);
    }
});

document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const urlParams = new URLSearchParams(window.location.search);
    const returnTo = urlParams.get('returnTo');

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const hashedPassword = CryptoJS.SHA256(password).toString(CryptoJS.enc.Base64);

    fetch('login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: username, pw: hashedPassword })
    }).then(response => {
        if (response.ok) {
            console.log('Login successful');

            let redirectTo;
            if (returnTo) {
                redirectTo = decodeURIComponent(returnTo);
            } else {
                // returnTo 없으면 referrer로부터 basePath 추출
                const referrer = document.referrer || '/';
                const segments = referrer.split('/').slice(3); // ['shadow', 'xxx']
                const basePath = (segments.length > 1) ? `/${segments[0]}` : '/';
                redirectTo = basePath;
                console.log('Fallback redirect to basePath:', basePath);
            }

            window.location.href = redirectTo;
        } else {
            console.log('Login failed');
            window.location.href = window.location.pathname + '?error=1';
        }
    }).catch(error => {
        console.error('Error:', error);
        document.getElementById('error-message').textContent = 'An error occurred. Please try again.';
    });
});
