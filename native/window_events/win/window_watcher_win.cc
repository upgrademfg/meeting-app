#include <windows.h>
#include <dwmapi.h>

#include <cwchar>
#include <string>
#include <unordered_map>
#include <vector>

#include "../window_watcher.h"

namespace window_events {
namespace {

struct AppIdentity {
  std::string name;
  std::string path;
};

std::string ToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  int length = WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  std::string result(length, '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), length, nullptr, nullptr);
  return result;
}

std::wstring WindowTitle(HWND hwnd) {
  int length = GetWindowTextLengthW(hwnd);
  std::wstring title(static_cast<size_t>(length) + 1, L'\0');
  int copied = GetWindowTextW(hwnd, title.data(), length + 1);
  title.resize(copied);
  return title;
}

std::wstring ProcessPath(DWORD pid) {
  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (!process) return {};
  std::wstring path(32768, L'\0');
  DWORD size = static_cast<DWORD>(path.size());
  if (!QueryFullProcessImageNameW(process, 0, path.data(), &size)) size = 0;
  CloseHandle(process);
  path.resize(size);
  return path;
}

std::wstring FileDescription(const std::wstring& path) {
  DWORD ignored = 0;
  DWORD size = GetFileVersionInfoSizeW(path.c_str(), &ignored);
  if (size == 0) return {};
  std::vector<BYTE> data(size);
  if (!GetFileVersionInfoW(path.c_str(), 0, size, data.data())) return {};

  struct Translation {
    WORD language;
    WORD codepage;
  };
  Translation* translation = nullptr;
  UINT translation_size = 0;
  if (!VerQueryValueW(data.data(), L"\\VarFileInfo\\Translation", reinterpret_cast<LPVOID*>(&translation), &translation_size) ||
      translation_size < sizeof(Translation)) {
    return {};
  }
  wchar_t key[64];
  swprintf(key, 64, L"\\StringFileInfo\\%04x%04x\\FileDescription", translation->language, translation->codepage);
  wchar_t* description = nullptr;
  UINT description_size = 0;
  if (!VerQueryValueW(data.data(), key, reinterpret_cast<LPVOID*>(&description), &description_size) || description_size == 0) {
    return {};
  }
  return std::wstring(description, wcsnlen(description, description_size));
}

std::wstring BaseName(const std::wstring& path) {
  size_t separator = path.find_last_of(L"\\/");
  return separator == std::wstring::npos ? path : path.substr(separator + 1);
}

std::optional<Bounds> WindowBounds(HWND hwnd) {
  RECT rect{};
  if (FAILED(DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, &rect, sizeof(rect))) && !GetWindowRect(hwnd, &rect)) {
    return std::nullopt;
  }
  return Bounds{static_cast<double>(rect.left), static_cast<double>(rect.top), static_cast<double>(rect.right - rect.left),
                static_cast<double>(rect.bottom - rect.top)};
}

void CALLBACK OnWinEvent(HWINEVENTHOOK, DWORD event, HWND hwnd, LONG object_id, LONG child_id, DWORD, DWORD);

class WinWindowWatcher;
WinWindowWatcher* active_watcher = nullptr;

class WinWindowWatcher final : public WindowWatcher {
 public:
  ~WinWindowWatcher() override { Stop(); }

  bool Start(WindowEventSink sink) override {
    if (active_watcher && active_watcher != this) return false;
    sink_ = std::move(sink);
    apps_.clear();
    active_watcher = this;
    foreground_hook_ = SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, nullptr, OnWinEvent, 0, 0, WINEVENT_OUTOFCONTEXT);
    object_hook_ = SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_NAMECHANGE, nullptr, OnWinEvent, 0, 0, WINEVENT_OUTOFCONTEXT);
    if (!foreground_hook_ || !object_hook_) {
      Stop();
      return false;
    }
    return true;
  }

  void Stop() override {
    if (foreground_hook_) UnhookWinEvent(foreground_hook_);
    if (object_hook_) UnhookWinEvent(object_hook_);
    foreground_hook_ = nullptr;
    object_hook_ = nullptr;
    if (active_watcher == this) active_watcher = nullptr;
    sink_ = nullptr;
  }

  std::optional<WindowInfo> ActiveWindow() override {
    HWND hwnd = GetForegroundWindow();
    if (!hwnd) return std::nullopt;
    return Describe(hwnd);
  }

  void Handle(DWORD event, HWND hwnd, LONG object_id, LONG child_id) {
    if (!sink_ || !hwnd || object_id != OBJID_WINDOW || child_id != CHILDID_SELF) return;
    if (event == EVENT_SYSTEM_FOREGROUND) {
      sink_(WindowEvent{WindowEventKind::kActivate, Describe(hwnd)});
      return;
    }
    if (hwnd != GetForegroundWindow()) return;
    WindowEventKind kind = event == EVENT_OBJECT_NAMECHANGE ? WindowEventKind::kTitle : WindowEventKind::kBounds;
    sink_(WindowEvent{kind, Describe(hwnd)});
  }

 private:
  const AppIdentity& Identify(DWORD pid) {
    auto cached = apps_.find(pid);
    if (cached != apps_.end()) return cached->second;
    std::wstring path = ProcessPath(pid);
    std::wstring name = FileDescription(path);
    if (name.empty()) name = BaseName(path);
    return apps_.emplace(pid, AppIdentity{ToUtf8(name), ToUtf8(path)}).first->second;
  }

  WindowInfo Describe(HWND hwnd) {
    DWORD pid = 0;
    GetWindowThreadProcessId(hwnd, &pid);
    const AppIdentity& app = Identify(pid);
    WindowInfo info;
    info.pid = pid;
    info.window_id = reinterpret_cast<intptr_t>(hwnd);
    info.app = app.name;
    info.app_path = app.path;
    info.title = ToUtf8(WindowTitle(hwnd));
    info.bounds = WindowBounds(hwnd);
    return info;
  }

  WindowEventSink sink_;
  HWINEVENTHOOK foreground_hook_ = nullptr;
  HWINEVENTHOOK object_hook_ = nullptr;
  std::unordered_map<DWORD, AppIdentity> apps_;
};

void CALLBACK OnWinEvent(HWINEVENTHOOK, DWORD event, HWND hwnd, LONG object_id, LONG child_id, DWORD, DWORD) {
  if (active_watcher) active_watcher->Handle(event, hwnd, object_id, child_id);
}

}

std::unique_ptr<WindowWatcher> CreateWindowWatcher() { return std::make_unique<WinWindowWatcher>(); }

}
