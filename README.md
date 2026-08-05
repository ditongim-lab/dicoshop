# 🥤 Discord 자판기 + 티켓 + 이벤트 관리 봇

포인트 기반 자판기(상점), 문의 티켓 시스템, 이벤트 포인트 지급, 안티레이드 허니팟 채널을 갖춘
Discord.js v14 기반 봇입니다. 데이터는 SQLite(`better-sqlite3`)에 저장됩니다.

## 📁 폴더 구조

```
discord-shop-bot/
├─ src/
│  ├─ commands/         # 슬래시 명령어
│  │  ├─ shop.js             # /shop
│  │  ├─ product-register.js # /제품등록
│  │  ├─ product-delete.js   # /제품삭제
│  │  ├─ product-info.js     # /제품설명
│  │  ├─ settings.js         # /설정
│  │  ├─ event-give.js       # /이벤트지급
│  │  └─ points.js           # /포인트
│  ├─ events/            # 디스코드 이벤트 핸들러
│  │  ├─ ready.js
│  │  ├─ interactionCreate.js
│  │  └─ messageCreate.js    # 허니팟 채널 감지
│  ├─ database/
│  │  └─ db.js               # SQLite 스키마 + 헬퍼 함수
│  ├─ systems/
│  │  ├─ shop.js             # 자판기 패널 / 구매 로직
│  │  ├─ ticket.js           # 티켓 생성/종료/트랜스크립트
│  │  ├─ payment.js          # 충전 요청 / 승인 / 거절
│  │  └─ logs.js             # 로그 채널 전송 헬퍼
│  ├─ utils/
│  │  └─ permissions.js      # 관리자/티켓관리자 권한 체크
│  ├─ config/
│  │  └─ emojis.js           # 커스텀(니트로) 이모지 설정
│  └─ index.js               # 봇 진입점
├─ deploy-commands.js     # 슬래시 명령어 등록 스크립트
├─ Procfile               # Railway 배포용
├─ package.json
├─ .env.example
└─ .gitignore
```

## ⚙️ 설치 방법

### 1. 프로젝트 클론 / 다운로드 후 설치

```bash
npm install
```

### 2. 디스코드 개발자 포털 설정

1. https://discord.com/developers/applications 에서 애플리케이션 생성
2. **Bot** 탭에서 봇 생성 후 토큰 발급
3. **Bot** 탭에서 다음 Privileged Gateway Intents 활성화:
   - `SERVER MEMBERS INTENT` (밴 처리, 멤버 조회에 필요)
   - `MESSAGE CONTENT INTENT` (허니팟 채널 메시지 감지에 필요)
4. **OAuth2 > URL Generator** 에서 `bot`, `applications.commands` 스코프 선택 후
   `Administrator` 권한(또는 최소: 채널 관리, 멤버 차단, 메시지 관리, 역할 멘션)으로 서버에 초대

### 3. 환경변수 설정

`.env.example` 을 `.env` 로 복사한 뒤 값을 채워주세요.

```
DISCORD_TOKEN=발급받은_봇_토큰
CLIENT_ID=애플리케이션_ID
GUILD_ID=테스트서버ID (선택, 비우면 글로벌 등록)
DATABASE_PATH=./data.sqlite
```

> Railway/Render 등 호스팅 플랫폼에서는 `.env` 파일 대신 대시보드의 **Variables/Environment** 탭에
> 위 값들을 직접 등록하세요.

### 4. 슬래시 명령어 등록

```bash
npm run deploy
```

- `GUILD_ID`를 지정하면 해당 서버에 즉시 반영됩니다 (테스트용 추천).
- 비워두면 글로벌 등록되며 반영까지 최대 1시간 걸릴 수 있습니다.

### 5. 봇 실행

```bash
npm start
```

## 🚀 배포 (Railway)

1. GitHub 저장소에 이 프로젝트를 업로드 (개별 파일 업로드 시 `.gitignore`, `Procfile`도 GitHub 웹 UI의
   "Add file > Create new file" 로 직접 생성하면 됩니다)
2. Railway에서 GitHub 레포 연결 → New Project
3. Variables 탭에 `DISCORD_TOKEN`, `CLIENT_ID` 등 환경변수 등록
4. `Procfile`의 `worker: node src/index.js` 가 자동으로 인식됩니다
5. 배포 후 로그에서 `✅ 로그인 완료` 메시지 확인

## 🧭 서버에서 초기 설정 순서

봇을 서버에 초대한 뒤 관리자가 아래 순서로 설정하는 것을 권장합니다.

```
/설정 티켓관리자역할 역할:@문의담당
/설정 티켓로그채널 채널:#티켓로그
/설정 티켓카테고리 카테고리:문의
/설정 로그채널 채널:#상점로그
/설정 충전계좌 계좌정보:국민은행 123456-78-901234 (예금주: 홍길동)
/설정 허니팟채널 채널:#숨겨진-채널
/제품등록 이름:콜라 가격:100 재고:20 설명:시원한 콜라
/shop
```

## 🍯 허니팟(보호) 채널 안내

원래 요청하신 "특정 채널에 메시지가 오면 작성자를 밴"하는 기능은,
**정상 멤버가 실수로 걸리지 않도록** 안티레이드 봇들이 쓰는 방식인 *허니팟 채널*로 구현했습니다.

- `/설정 허니팟채널` 로 지정한 채널은 **반드시 @everyone 열람 권한을 차단**해두세요.
- 정상적인 멤버는 채널이 보이지 않아 메시지를 보낼 수 없고,
  전체 채널을 훑으며 스팸을 뿌리는 레이드 봇/계정만 감지되어 자동 차단됩니다.
- 서버 관리자(Administrator 권한 보유자)는 예외 처리되어 테스트 중 실수로 차단되지 않습니다.

## 🪙 포인트 자판기 흐름

1. `/shop` → 자판기 패널 출력 (제품/가격/재고 표시)
2. **구매하기** → 셀렉트 메뉴에서 제품 선택 → 포인트 확인 → 차감 → 재고 감소 → 완료 메시지
3. **충전하기** → 금액 입력 모달 → 로그 채널에 승인/거절 버튼 있는 요청 게시 →
   티켓 관리자가 입금 확인 후 **승인** 클릭 → 포인트 자동 지급
4. **문의하기** → 개인 티켓 채널 생성 → 티켓 관리자 역할 멘션 → **닫기** 클릭 시
   대화 내용이 TXT로 저장되어 티켓 로그 채널에 전송, 채널은 3초 후 삭제

## 🎨 커스텀(니트로) 이모지 변경

`src/config/emojis.js` 파일에서 원하는 이모지로 교체하세요.
서버 커스텀 이모지를 쓰려면 `\:이모지이름:` 을 채팅에 입력해 나오는
`<:이름:ID>` 형식 문자열을 그대로 붙여넣으면 됩니다.

```js
// 예시
vending: '<:vending:1234567890123456789>',
```

## 🛠 커맨드 목록

| 명령어 | 설명 | 권한 |
|---|---|---|
| `/shop` | 자판기 패널 표시 | 전체 |
| `/포인트 [유저]` | 포인트 확인 | 전체 |
| `/제품설명 이름` | 제품 상세 Embed | 전체 |
| `/제품등록` | 제품 등록 | 관리자 |
| `/제품삭제` | 제품 삭제 | 관리자 |
| `/이벤트지급` | 이벤트 포인트 지급 | 관리자 |
| `/설정` | 각종 채널/역할/계좌 설정 | 관리자 |

## ❗ 문제 해결

- **명령어가 안 보여요**: `npm run deploy` 실행 여부 확인, 글로벌 등록은 최대 1시간 소요
- **밴이 안 돼요**: 봇 역할이 대상 유저보다 위에 있는지, `Ban Members` 권한이 있는지 확인
- **메시지 내용이 안 잡혀요**: 개발자 포털에서 `MESSAGE CONTENT INTENT` 활성화 여부 확인
- **better-sqlite3 설치 오류(Node 버전 문제)**: Node 18 이상 사용, 호스팅 플랫폼의 Node 버전 설정 확인
