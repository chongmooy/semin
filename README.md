# 세민전 방문 차량 예약

명수당 방문 차량 예약(Parking)과 **같은 DB**를 쓰지만, 화면은 이 레포만으로 따로 운영하는 세민전 전용 사이트입니다.

## 파일
| 파일 | 설명 |
|---|---|
| `index.html` · `semin.js` · `semin.css` | 예약 신청 + 내 예약 확인·취소 (세민전 예약만 보여 줌) |
| `pass.html` · `pass.js` · `pass.css` | 실시간 예약확인증 (세민전 예약만 · 정기 차량은 그대로 표시) |
| `config.js` | DB 연결 정보 — **Parking 레포의 config.js 내용을 그대로 복사**해서 넣으세요 (anon 키만, service_role 키는 절대 넣지 않기) |
| `supabase.js` · `stats.js` | DB 연결 라이브러리 · 접속 수 세기 (관리자 페이지 접속 현황에 "세민전"으로 나옴) |
| `icon.svg` · `icon-192.png` | 아이콘 |

## 올리는 방법 (GitHub 웹)
1. 새 레포를 만들고 위 파일을 모두 올립니다. `config.js`는 Parking 레포의 것과 같은 내용으로.
2. Settings → Pages → Branch: `main` / `(root)` → Save.
3. 1~2분 뒤 `https://<계정>.github.io/<레포 이름>/` 으로 열립니다. 확인증은 같은 주소 뒤에 `pass.html`.

## 운영
- 정원·공개 일시·열기/닫기: Parking 관리자 페이지 → **세민전 예약** 칸
- 시간대·날짜: Supabase Table Editor → `event_slots` · `events`
- 확인 앱(출입구)은 명수당 앱 그대로 — 세민전 시간대로 입차 가능 여부를 판정합니다.
