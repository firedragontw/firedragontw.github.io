document.addEventListener('DOMContentLoaded', () => {
    // 獲取當前的路徑名稱
    const pathname = window.location.pathname;
    
    // 移除開頭的斜線並分割路徑
    const path = pathname.replace(/^\//, '').split('/');
    
    // 定義路由對應表
    const routes = {
        
        'yihsin': '/yihsin.html',
        'ptcg': '/ptcg.html',
        'egc': '/egc.html',
        'learningcard': '/learningcard.html',
    };
    
    // 確定要載入的 HTML 檔案
    let htmlFile = null;
    if (path[0] === 'fire.dragon.lifestyle' && path[1] === 'yihsin') {
        htmlFile = routes['fire.dragon.lifestyle']['yihsin'];
    } else if (routes[path[0]]) {
        htmlFile = routes[path[0]];
    }
    
    // 如果找到對應的路由，載入相應的 HTML
    if (htmlFile) {
        fetch(htmlFile)
            .then(response => {
                if (!response.ok) {
                    throw new Error('找不到頁面');
                }
                return response.text();
            })
            .then(html => {
                document.getElementById('content').innerHTML = html;
            })
            .catch(error => {
                console.error('載入頁面時發生錯誤:', error);
                document.getElementById('content').innerHTML = `
                    <h1>404 - 找不到頁面</h1>
                    <p>抱歉，請求的頁面不存在。</p>
                `;
            });
    }
});