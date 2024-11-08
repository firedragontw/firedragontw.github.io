document.addEventListener('DOMContentLoaded', () => {
    // 獲取當前的路徑名稱
    const pathname = window.location.pathname;
    
    // 移除開頭的斜線並分割路徑
    const path = pathname.replace(/^\//, '').split('/');
    
    // 檢查是否匹配 fire.dragon.lifestyle/yihsin 模式
    if (path[0] === 'fire.dragon.lifestyle' && path[1] === 'yihsin') {
        // 使用 fetch 載入 yihsin.html
        fetch('/yihsin.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error('找不到頁面');
                }
                return response.text();
            })
            .then(html => {
                // 將內容插入到主要容器中
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
<<<<<<< HEAD

    // 檢查是否匹配 ptcg 模式
    else if (path[0] === 'ptcg') {
        // 使用 fetch 載入 ptcg.html
        fetch('/ptcg.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error('找不到頁面');
                }
                return response.text();
            })
            .then(html => {
                // 將內容插入到主要容器中
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
=======
>>>>>>> 1302a71c7a6cb10db323d49a4107b148c57e1004
});