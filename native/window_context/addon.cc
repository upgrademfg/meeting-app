#include <napi.h>

#include <functional>
#include <string>

#include "context_reader.h"

namespace {

class TextWorker final : public Napi::AsyncWorker {
 public:
  TextWorker(Napi::Env env, std::function<std::string()> task)
      : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)), task_(std::move(task)) {}

  Napi::Promise Promise() const { return deferred_.Promise(); }

 protected:
  void Execute() override { result_ = task_(); }
  void OnOK() override { deferred_.Resolve(Napi::String::New(Env(), result_)); }

 private:
  Napi::Promise::Deferred deferred_;
  std::function<std::string()> task_;
  std::string result_;
};

Napi::Value Queue(Napi::Env env, std::function<std::string()> task) {
  auto* worker = new TextWorker(env, std::move(task));
  Napi::Promise promise = worker->Promise();
  worker->Queue();
  return promise;
}

Napi::Value Reject(Napi::Env env, const char* message) {
  Napi::TypeError::New(env, message).ThrowAsJavaScriptException();
  return env.Undefined();
}

#if defined(__APPLE__)
Napi::Value RunAppleScript(const Napi::CallbackInfo& info) {
  if (info.Length() < 1 || !info[0].IsString()) return Reject(info.Env(), "runAppleScript(source) requires a string");
  std::string source = info[0].As<Napi::String>();
  return Queue(info.Env(), [source] { return window_context::RunAppleScript(source); });
}
#endif

#if defined(_WIN32)
Napi::Value ExplorerFolder(const Napi::CallbackInfo& info) {
  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsString()) {
    return Reject(info.Env(), "explorerFolder(hwnd, title) requires a number and a string");
  }
  int64_t hwnd = info[0].As<Napi::Number>().Int64Value();
  std::string title = info[1].As<Napi::String>();
  return Queue(info.Env(), [hwnd, title] { return window_context::ExplorerFolder(hwnd, title); });
}
#endif

Napi::Object Init(Napi::Env env, Napi::Object exports) {
#if defined(__APPLE__)
  exports.Set("runAppleScript", Napi::Function::New(env, RunAppleScript));
#endif
#if defined(_WIN32)
  exports.Set("explorerFolder", Napi::Function::New(env, ExplorerFolder));
#endif
  return exports;
}

}

NODE_API_MODULE(window_context, Init)
