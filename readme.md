# meeting-app

회의 버튼 하나로 **모든 모니터 화면 + 시스템 사운드 + 마이크**를 하나의 MP4로 녹화하고,
같은 타임라인으로 **마우스·앱 전환·파일/폴더 열기 이벤트**를 기록하는 데스크탑 앱 (Electron + TypeScript).

- 지원: macOS 13+, Windows 10+
- 키보드 입력은 기록하지 않음

## 실행

```bash
yarn install       # Electron 다운로드와 네이티브 애드온 빌드까지
yarn dev           # 개발 모드
yarn build         # 타입체크 + 빌드
yarn dist:mac      # macOS 패키징 (dmg)
yarn dist:win      # Windows 패키징 (nsis) — Windows에서 실행
```

- Node 22.22.2 이상, Yarn 4(저장소에 포함된 버전으로 실행됨)
- 네이티브 애드온 빌드에 macOS는 Xcode Command Line Tools, Windows는 Visual Studio Build Tools(C++)와 Python이 필요

## macOS 권한

화면 및 시스템 오디오 녹음, 마이크, 손쉬운 사용 권한이 필요합니다. 컨트롤 창의 "권한 요청하기"나 시스템 설정 > 개인정보 보호 및 보안에서 허용하고, 화면 녹화 권한은 허용 후 앱을 다시 실행해야 적용됩니다.

`yarn dev`로 실행하면 권한이 "Electron"이 아니라 실행한 터미널 앱에 적용됩니다. "Electron"에 권한을 주고 쓰려면 빌드 결과를 직접 실행합니다.

```bash
yarn build && open -n -a node_modules/electron/dist/Electron.app --args "$PWD"
```

## 산출물

```
<저장 폴더>/2026-11-24_14-30-00.mp4    # H.264 + AAC
<저장 폴더>/2026-11-24_14-30-00.json   # 녹화 정보 + 이벤트
```

녹화 중에는 이벤트를 `.recording.jsonl`에 기록하고, 녹화가 끝나거나 크래시 후 복구될 때 `.json` 하나로 합칩니다.

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

`startedAt`은 영상의 0초 시각이고, 크래시 후 복구된 녹화는 `recovered`가 `true`입니다. 모든 이벤트에 `timestamp`(ISO 8601 UTC)와 `offsetMs`(영상 재생 위치)가 있고, `x`/`y`와 `window`는 영상의 픽셀 좌표입니다.

### 이벤트

예시에서는 모든 이벤트에 공통으로 들어가는 `timestamp`, `offsetMs`를 생략했습니다.

| type | 필드 | 예시 |
|---|---|---|
| `mouse_down` | button, clicks, x, y | `{"type":"mouse_down","button":"left","clicks":2,"x":1728,"y":1598}` |
| `mouse_move` | x, y (최대 10Hz) | `{"type":"mouse_move","x":1995,"y":953}` |
| `wheel` | direction, rotation, x, y | `{"type":"wheel","direction":"vertical","rotation":4,"x":1448,"y":1815}` |
| `window_active` | app, title, window, 그리고 알 수 있을 때 url(mac 브라우저)·file(문서, Windows는 창 제목에 이름이 있는 최근 항목 파일)·folder(Finder·Explorer) — 활성화된 창이 바뀜 (앱 전환, 탭 전환, 페이지·폴더 이동) | `{"type":"window_active","app":"Safari","title":"Example Domain","url":"https://example.com/","window":{"x":0,"y":0,"width":3840,"height":2160}}`<br>`{"type":"window_active","app":"미리보기","title":"report.pdf – 1페이지","file":"/Users/me/Documents/report.pdf","window":{"x":6,"y":51,"width":1374,"height":1910}}`<br>`{"type":"window_active","app":"Finder","title":"다운로드","folder":"/Users/me/Downloads/","window":{"x":1497,"y":681,"width":1380,"height":654}}` |
| `window_move` | app, title, window — 창 이동·크기 조절이 끝난 최종 위치 | `{"type":"window_move","app":"Finder","title":"다운로드","window":{"x":450,"y":450,"width":1350,"height":900}}` |
| `warning` | message | `{"type":"warning","message":"마이크를 사용할 수 없습니다. 내 목소리가 녹음되지 않습니다."}` |

## 알려진 제약

- 드래그 중 마우스 이동은 기록되지 않음
- `window_active`의 `file`은 문서 경로를 알려주지 않는 앱에서는 빠짐
- `ffmpeg-static` 바이너리는 GPL 빌드 — 상용 배포 전 라이선스 검토 필요
- Windows 패키징은 Windows에서 해야 함
