#include "../window_watcher.h"

namespace window_events {
namespace {

class StubWindowWatcher final : public WindowWatcher {
 public:
  bool Start(WindowEventSink) override { return false; }
  void Stop() override {}
  std::optional<WindowInfo> ActiveWindow() override { return std::nullopt; }
};

}

std::unique_ptr<WindowWatcher> CreateWindowWatcher() { return std::make_unique<StubWindowWatcher>(); }

}
