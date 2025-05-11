// public/js/navbar.js
document.addEventListener('DOMContentLoaded', () => {
    fetch(`${window.BASE_PATH}managementView/navbar`)
        .then(response => response.text())
        .then(data => {
            document.getElementById('navbar').innerHTML = data;
        })
        .catch(error => console.error('Error loading navbar:', error));
});
