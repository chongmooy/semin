# 세민전 방문 차량 예약 (신청 페이지)

명수당 방문 차량 예약(Parking)과 **같은 DB**를 쓰는 세민전 전용 신청 페이지입니다.

## 파일
| 파일 | 설명 |
|---|---|
| `index.html` | 신청 화면 (명수당 신청 화면과 같은 구성) |
| `semin.js` | 신청 동작 — 행사 코드 `semin` 으로 예약 |
| `semin.css` | 화면 모양 |
| `icon.svg`, `icon-192.png` | 아이콘 |

`config.js`·`supabase.js`는 올리지 않습니다. `index.html` 안의 `https://minjipark85.github.io/Parking/` 에서 불러옵니다.
Parking 사이트 주소가 바뀌면 `index.html`에서 이 주소를 모두 바꿔 주세요.

## 올리는 방법 (GitHub 웹)
1. 새 레포를 만들고 위 파일을 모두 올립니다.
2. Settings → Pages → Branch: `main` / `(root)` → Save.
3. 1~2분 뒤 `https://<계정>.github.io/<레포 이름>/` 으로 열립니다.

## 운영
- 정원·공개 일시·열기/닫기: Parking 관리자 페이지 → **세민전 예약** 칸
- 시간대·날짜: Supabase Table Editor → `event_slots` · `events`
- 예약 확인·취소, 실시간 예약확인증: Parking 사이트 페이지를 그대로 씁니다.
