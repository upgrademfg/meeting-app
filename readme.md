# meeting-app

회의 버튼 하나로 **모든 모니터 화면 + 시스템 사운드 + 마이크**를 하나의 MP4로 녹화하고,
같은 타임라인으로 **마우스·앱 전환·파일/폴더 열기 이벤트**를 기록하는 데스크탑 앱 (Electron + TypeScript).

- 지원: macOS 13+, Windows 10+
- 키보드 입력은 기록하지 않음

## 실행

```bash
npm install
npm run dev        # 개발 모드
npm run build      # 타입체크 + 빌드
npm run dist:mac   # macOS 패키징 (dmg)
npm run dist:win   # Windows 패키징 (nsis) — Windows에서 실행
```

> npm 11은 설치 스크립트를 기본 차단합니다. 처음 설치할 때
> `npm install-scripts approve ffmpeg-static get-windows uiohook-napi` 가 필요할 수 있습니다.

## 산출물

```
<저장 폴더>/2026-11-24_14-30-00.mp4            # H.264 + AAC
<저장 폴더>/2026-11-24_14-30-00.events.jsonl   # 이벤트 로그
```

모든 이벤트에 `timestamp`(발생 시각, ISO 8601 UTC)와 `offsetMs`(녹화 시작 기준 ms, 영상 재생 위치와 같음)가 들어갑니다. `x`/`y`는 영상의 픽셀 좌표이고, 첫 줄은 `meta` 이벤트입니다.

| type | 필드 |
|---|---|
| `mouse_down` | button, clicks, x, y |
| `mouse_move` | x, y (최대 10Hz) |
| `wheel` | direction, rotation, x, y |
| `app_switch` / `window_title` | app, title, url(mac 브라우저), window |
| `folder_active` | path, app, window — 지금 활성화된 폴더가 바뀜 (폴더를 열거나 그 창으로 전환) |
| `file_active` | path, app, window — 지금 활성화된 파일이 바뀜 (파일을 열거나 그 문서 창으로 전환) |
| `warning` | message |

`window`는 활성 창의 위치와 크기 `{x, y, width, height}`이며 마우스 좌표와 같은 영상 픽셀 기준입니다. Windows 최근 항목에서 온 `file_active`/`folder_active`에는 없습니다.

## 구조

```
src/main/
  index.ts                     앱 생명주기, 트레이, 컨트롤 창, IPC
  state.ts                     UI로 브로드캐스트되는 앱 상태
  permissions.ts               macOS 권한 조회/요청
  recording/recording_service  녹화 한 건의 생명주기 (시작 → 청크 저장 → MP4 변환, 크래시 복구)
  recording/layout.ts          모든 모니터를 한 캔버스로 배치
  recording/ffmpeg.ts          WebM → MP4
  events/event_log.ts          .events.jsonl 기록
  events/input_tracker.ts      전역 마우스 (uiohook-napi)
  events/context_tracker.ts     활성 창, 파일/폴더 열기 (get-windows + OS별 조회)
src/renderer/
  src/recorder/recorder.ts     숨김 창 녹화 엔진 (캡처, 합성, 오디오 믹스, MediaRecorder)
  src/app.tsx                  컨트롤 창 UI
```

## 스파이크 체크리스트

- [ ] macOS: 시스템 사운드(loopback)가 실제로 녹음되는가 (`meta.hasSystemAudio`)
- [ ] Windows: 시스템 사운드 녹음
- [ ] MediaRecorder가 H.264를 선택하는가 (`meta.mimeType`), 1시간 녹화 시 CPU 사용률
- [ ] 모니터 2대 이상 합성 시 프레임 드랍/CPU
- [ ] 스피커 사용 시 에코 정도
- [ ] macOS 손쉬운 사용 권한 후 마우스 이벤트 기록
- [ ] Finder 폴더 / 문서 앱(Preview, Pages, Office) 파일 경로 기록
- [ ] Windows Explorer 폴더 / 최근 항목 기반 파일 열기 기록
- [ ] 녹화 중 강제 종료 → 재실행 시 MP4 복구

## 알려진 제약

- 드래그 중 마우스 이동은 기록되지 않음 (uiohook-napi가 drag 이벤트를 전달하지 않음)
- `file_active`는 mac에서 앞에 있는 창의 문서 경로를 읽으므로 문서 경로를 알려주지 않는 앱에서는 누락됨
- `ffmpeg-static` 바이너리는 GPL 빌드 — 상용 배포 전 라이선스 검토 필요 (H.264 녹화 시에는 복사만 하므로 LGPL 빌드로 교체 가능)
- `ffmpeg-static`은 설치한 OS의 바이너리만 받으므로 Windows 빌드는 Windows에서 패키징
