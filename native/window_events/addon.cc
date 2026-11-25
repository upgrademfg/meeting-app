#include <napi.h>

#include "window_watcher.h"

namespace {

using window_events::CreateWindowWatcher;
using window_events::WindowEvent;
using window_events::WindowEventKind;
using window_events::WindowInfo;
using window_events::WindowWatcher;

std::unique_ptr<WindowWatcher> watcher;
Napi::ThreadSafeFunction listener;
bool running = false;

const char* KindName(WindowEventKind kind) {
  switch (kind) {
    case WindowEventKind::kActivate:
      return "activate";
    case WindowEventKind::kTitle:
      return "title";
    case WindowEventKind::kBounds:
      return "bounds";
  }
  return "activate";
}

Napi::Object ToJs(Napi::Env env, const WindowInfo& window) {
  Napi::Object result = Napi::Object::New(env);
  result.Set("pid", Napi::Number::New(env, static_cast<double>(window.pid)));
  result.Set("windowId", Napi::Number::New(env, static_cast<double>(window.window_id)));
  result.Set("app", window.app);
  result.Set("appPath", window.app_path);
  result.Set("title", window.title);
  if (!window.bundle_id.empty()) result.Set("bundleId", window.bundle_id);
  if (!window.document_url.empty()) result.Set("documentUrl", window.document_url);
  if (window.bounds) {
    Napi::Object bounds = Napi::Object::New(env);
    bounds.Set("x", window.bounds->x);
    bounds.Set("y", window.bounds->y);
    bounds.Set("width", window.bounds->width);
    bounds.Set("height", window.bounds->height);
    result.Set("bounds", bounds);
  }
  return result;
}

void StopWatching() {
  if (!running) return;
  running = false;
  watcher->Stop();
  listener.Release();
}

void Deliver(WindowEvent event) {
  auto* data = new WindowEvent(std::move(event));
  napi_status status = listener.NonBlockingCall(data, [](Napi::Env env, Napi::Function callback, WindowEvent* event) {
    if (env != nullptr) {
      Napi::Object payload = Napi::Object::New(env);
      payload.Set("kind", KindName(event->kind));
      payload.Set("window", ToJs(env, event->window));
      callback.Call({payload});
    }
    delete event;
  });
  if (status != napi_ok) delete data;
}

Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (running) return Napi::Boolean::New(env, true);
  if (info.Length() < 1 || !info[0].IsFunction()) {
    Napi::TypeError::New(env, "start(listener) requires a function").ThrowAsJavaScriptException();
    return env.Undefined();
  }
  listener = Napi::ThreadSafeFunction::New(env, info[0].As<Napi::Function>(), "window_events", 0, 1);
  listener.Unref(env);
  if (!watcher) watcher = CreateWindowWatcher();
  running = watcher->Start(Deliver);
  if (!running) listener.Release();
  return Napi::Boolean::New(env, running);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  StopWatching();
  return info.Env().Undefined();
}

Napi::Value ActiveWindow(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!watcher) watcher = CreateWindowWatcher();
  std::optional<WindowInfo> window = watcher->ActiveWindow();
  return window ? ToJs(env, *window) : env.Null();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("activeWindow", Napi::Function::New(env, ActiveWindow));
  env.AddCleanupHook([] {
    StopWatching();
    watcher.reset();
  });
  return exports;
}

}

NODE_API_MODULE(window_events, Init)
