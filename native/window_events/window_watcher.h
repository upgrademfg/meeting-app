#pragma once

#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>

namespace window_events {

struct Bounds {
  double x = 0;
  double y = 0;
  double width = 0;
  double height = 0;
};

struct WindowInfo {
  int64_t pid = 0;
  int64_t window_id = 0;
  std::string app;
  std::string app_path;
  std::string bundle_id;
  std::string title;
  std::string document_url;
  std::optional<Bounds> bounds;
};

enum class WindowEventKind { kActivate, kTitle, kBounds };

struct WindowEvent {
  WindowEventKind kind;
  WindowInfo window;
};

using WindowEventSink = std::function<void(WindowEvent)>;

class WindowWatcher {
 public:
  virtual ~WindowWatcher() = default;
  virtual bool Start(WindowEventSink sink) = 0;
  virtual void Stop() = 0;
  virtual std::optional<WindowInfo> ActiveWindow() = 0;
};

std::unique_ptr<WindowWatcher> CreateWindowWatcher();

}
