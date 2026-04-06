# NYCU 選課助手 - 隱私權政策

最後更新日期：2026 年 4 月 6 日

## 1. 資料收集

本擴充功能**不收集任何使用者個人資訊**。不會追蹤您的瀏覽行為、不會記錄個人識別資訊、不會使用任何分析工具。

## 2. 本地資料儲存

擴充功能在您的本地瀏覽器中儲存以下資料（使用 Chrome Storage API）：

- **課程資料**：從 NYCU 官方 API 取得的公開課程資訊（名稱、代碼、教師、時間、地點、學分等），快取 7 天後自動過期
- **書籤與課表**：您收藏的課程和排定的課表，永久儲存直到您手動清除
- **AI 設定**：您的 Gemini API 金鑰和 AI 功能偏好設定
- **AI 關鍵字快取**：AI 為課程提取的搜尋關鍵字

以上資料**僅存在於您的本地瀏覽器**，不會上傳到我們的任何伺服器。

## 3. 外部服務連線

本擴充功能會連線至以下外部服務：

### NYCU 課程時間表 API
- **網址**：`https://timetable.nycu.edu.tw/`
- **用途**：取得公開的課程資料
- **傳送的資料**：學期代碼、系所代碼等查詢參數（不含個人資訊）

### Google Gemini API（選用功能）
- **網址**：`https://generativelanguage.googleapis.com/`
- **用途**：AI 智能課程搜尋與關鍵字提取
- **傳送的資料**：您的搜尋查詢文字、課程名稱與概述（用於 AI 分析）
- **注意**：此功能需要您自行申請並提供 Gemini API 金鑰。API 金鑰僅儲存在本地，不會經過我們的伺服器。傳送至 Google 的資料受 [Google 隱私權政策](https://policies.google.com/privacy)規範
- **停用方式**：在設定中關閉「啟用 AI 智能搜尋」即可完全停用此功能

## 4. 資料安全

- 所有資料僅使用 Chrome Storage API 儲存於本地瀏覽器
- API 金鑰儲存在 `chrome.storage.local`，僅擴充功能本身可存取
- 所有外部資料輸出均經 HTML 跳脫處理，防止 XSS 攻擊
- 建議在 Google Cloud Console 對 Gemini API Key 設定使用範圍限制（HTTP referrer 或 IP 限制）

## 5. 第三方程式庫

本擴充功能使用以下第三方程式庫：

- **html2canvas v1.4.1**：用於課表截圖匯出，完全在本地執行，不傳送任何資料

## 6. 權限說明

| 權限 | 用途 |
|------|------|
| `storage` | 在本地儲存課程資料、書籤、課表與設定 |
| `activeTab` | 開啟側邊欄時取得當前分頁資訊 |
| `sidePanel` | 提供側邊欄介面 |
| `host_permissions` (timetable.nycu.edu.tw) | 從官方 API 取得課程資料 |
| `host_permissions` (generativelanguage.googleapis.com) | AI 搜尋功能（選用） |

## 7. 兒童隱私

本服務不針對 13 歲以下兒童，也不會故意收集兒童的個人資訊。

## 8. 政策變更

本隱私權政策可能會配合擴充功能更新而修改。任何變更將在此頁面公告，並更新「最後更新日期」。

## 9. 開源透明

本擴充功能完全開源，您可以在 [GitHub](https://github.com/NYCU-Chung/portal_course_registration) 檢視所有程式碼，驗證上述聲明。

## 10. 聯絡方式

如有任何隱私相關問題，請透過 [GitHub Issues](https://github.com/NYCU-Chung/portal_course_registration/issues) 聯繫。
