# meeting-app

회의 버튼 하나로 **모든 모니터 화면 + 시스템 사운드 + 마이크**를 하나의 MP4로 녹화하고,
같은 타임라인으로 **마우스·앱 전환·파일/폴더 열기 이벤트**를 기록하는 데스크탑 앱 (Electron + TypeScript).

- 지원: macOS 13+, Windows 10+
- 키보드 입력은 기록하지 않음

## 실행

```bash
npm install        # 네이티브 애드온(native/window_events)도 함께 빌드
npm run dev        # 개발 모드
npm run build      # 타입체크 + 빌드
npm run dist:mac   # macOS 패키징 (dmg)
npm run dist:win   # Windows 패키징 (nsis) — Windows에서 실행
```

> 네이티브 애드온 빌드에는 macOS는 Xcode Command Line Tools, Windows는 Visual Studio Build Tools(C++)와 Python이 필요합니다.
> npm 11은 의존성의 설치 스크립트를 기본 차단하므로 처음 설치할 때
> `npm install-scripts approve ffmpeg-static uiohook-napi` 가 필요할 수 있습니다.

## 산출물

```
<저장 폴더>/2026-11-24_14-30-00.mp4    # H.264 + AAC
<저장 폴더>/2026-11-24_14-30-00.json   # 녹화 정보 + 이벤트
```

녹화 중에는 이벤트를 `.recording.jsonl`에 기록하고, 녹화가 끝나거나 크래시 후 복구될 때 `.json` 하나로 합친 뒤 지웁니다.

```json
{
  "version": 2,
  "video": "2026-11-24_14-30-00.mp4",
  "platform": "darwin",
  "width": 3840,
  "height": 2160,
  "screens": [{ "displayId": "2", "x": 0, "y": 0, "width": 3840, "height": 2160 }],
  "mimeType": "video/x-matroska;codecs=avc1,opus",
  "hasSystemAudio": true,
  "hasMic": true,
  "startedAt": "2026-11-24T05:30:01.120Z",
  "endedAt": "2026-11-24T06:12:44.903Z",
  "recovered": false,
  "events": [
    { "timestamp": "2026-11-24T05:30:01.480Z", "offsetMs": 360, "type": "mouse_move", "x": 1995, "y": 953 }
  ]
}
```

`startedAt`은 영상의 0초 시각입니다. 크래시 후 복구된 녹화는 `recovered`가 `true`이고 `endedAt`이 없습니다. `events`는 `offsetMs` 순서로 정렬되며, 모든 이벤트에 `timestamp`(발생 시각, ISO 8601 UTC)와 `offsetMs`(녹화 시작 기준 ms, 영상 재생 위치와 같음)가 들어갑니다. `x`/`y`는 영상의 픽셀 좌표입니다.

| type | 필드 |
|---|---|
| `mouse_down` | button, clicks, x, y |
| `mouse_move` | x, y (최대 10Hz) |
| `wheel` | direction, rotation, x, y |
| `app_switch` / `window_title` | app, title, url(mac 브라우저), window |
| `window_move` | app, title, window — 창 이동·크기 조절이 끝난 최종 위치 |
| `folder_active` | path, app, window — 지금 활성화된 폴더가 바뀜 (폴더를 열거나 그 창으로 전환) |
| `file_active` | path, app, window — 지금 활성화된 파일이 바뀜 (파일을 열거나 그 문서 창으로 전환) |
| `warning` | message |

`window`는 활성 창의 위치와 크기 `{x, y, width, height}`이며 마우스 좌표와 같은 영상 픽셀 기준입니다. Windows 최근 항목에서 온 `file_active`/`folder_active`에는 없습니다.

## 구조

```
native/                          네이티브 애드온 (N-API, binding.gyp 하나에 두 타깃)
  window_events/                 활성 창 이벤트
    window_watcher.h             OS 공통 인터페이스 (WindowWatcher, WindowInfo)
    addon.cc                     JS 바인딩: start(listener), stop(), activeWindow()
    mac/window_watcher_mac.mm    NSWorkspace 앱 활성화 + AXObserver 제목·이동·크기
    win/window_watcher_win.cc    SetWinEventHook 포그라운드·제목·위치
  window_context/                창이 열고 있는 폴더·URL 조회 (워커 스레드에서 실행)
    context_reader.h             OS별 조회 함수
    addon.cc                     JS 바인딩: runAppleScript(source) (mac), explorerFolder(hwnd, title) (win)
    mac/apple_script.mm          NSAppleScript를 프로세스 안에서 실행
    win/explorer_folder.cc       IShellWindows COM으로 Explorer 창의 현재 폴더
src/main/
  index.ts                       앱 생명주기, 트레이, 컨트롤 창, IPC
  state.ts                       UI로 브로드캐스트되는 앱 상태
  permissions.ts                 macOS 권한 조회/요청
  recording/recording_service    녹화 한 건의 생명주기 (시작 → 청크 저장 → MP4 변환, 크래시 복구)
  recording/layout.ts            모든 모니터를 한 캔버스로 배치
  recording/ffmpeg.ts            WebM → MP4
  input/mouse_hub.ts             전역 마우스 hook(uiohook) 공용 구독 — 이벤트 기록과 커서 효과가 함께 사용
  cursor_status/                 커서 옆 상태 배지
    cursor_status_presenter.ts   앱 상태 → 보여줄 상태·메시지 결정 (녹화 중, 경고, 저장 완료 등)
    cursor_status_window.ts      커서를 따라다니는 배지 창 (화면 끝에서 반대편으로, 클릭 통과, 캡처 제외)
  activity/                      활동 이벤트 기록
    index.ts                     조립 (플랫폼별 어댑터 선택, startActivityTracking)
    domain/                      이벤트·창 정보 타입과 순수 규칙
    ports/                       application이 의존하는 인터페이스
    application/                 창·마우스 추적 로직 (플랫폼 무관)
    infrastructure/              네이티브 애드온, uiohook, Windows 최근 항목, JSONL 기록 어댑터
src/renderer/
  src/recorder/recorder.ts     숨김 창 녹화 엔진 (캡처, 합성, 오디오 믹스, MediaRecorder)
  src/app.tsx                  컨트롤 창 UI
  cursor_status.html, src/cursor_status/  상태 배지 화면 (상태 점, 문구, 녹화 시간)
```

## 스파이크 체크리스트

- [ ] macOS: 시스템 사운드(loopback)가 실제로 녹음되는가 (`.json`의 `hasSystemAudio`)
- [ ] Windows: 시스템 사운드 녹음
- [ ] MediaRecorder가 H.264를 선택하는가 (`.json`의 `mimeType`), 1시간 녹화 시 CPU 사용률
- [ ] 모니터 2대 이상 합성 시 프레임 드랍/CPU
- [ ] 스피커 사용 시 에코 정도
- [ ] macOS 손쉬운 사용 권한 후 마우스 이벤트 기록
- [ ] Finder 폴더 / 문서 앱(Preview, Pages, Office) 파일 경로 기록
- [ ] Windows Explorer 폴더 / 최근 항목 기반 파일 열기 기록
- [ ] 창 이동·크기 조절·최대화 시 `window_move` 한 번만 기록
- [ ] 상태 배지가 커서를 끊김 없이 따라가는지, 화면 끝에서 반대편으로 넘어가는지, 전체 화면 앱 위에도 뜨는지, 녹화 영상에는 안 찍히는지
- [ ] Windows에서 네이티브 애드온 빌드 (window_events, window_context)
- [ ] 녹화 중 강제 종료 → 재실행 시 MP4 복구

## 알려진 제약

- 드래그 중 마우스 이동은 기록되지 않음 (uiohook-napi가 drag 이벤트를 전달하지 않음)
- `file_active`는 mac에서 앞에 있는 창의 문서 경로를 읽으므로 문서 경로를 알려주지 않는 앱에서는 누락됨
- `ffmpeg-static` 바이너리는 GPL 빌드 — 상용 배포 전 라이선스 검토 필요 (H.264 녹화 시에는 복사만 하므로 LGPL 빌드로 교체 가능)
- `ffmpeg-static`은 설치한 OS의 바이너리만 받으므로 Windows 빌드는 Windows에서 패키징
