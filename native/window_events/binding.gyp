{
  "targets": [
    {
      "target_name": "window_events",
      "sources": ["src/addon.cc"],
      "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS", "NAPI_VERSION=8"],
      "cflags_cc": ["-std=c++20"],
      "conditions": [
        ["OS=='mac'", {
          "sources": ["src/mac/window_watcher_mac.mm"],
          "link_settings": {
            "libraries": ["-framework AppKit", "-framework ApplicationServices"]
          },
          "xcode_settings": {
            "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
            "CLANG_ENABLE_OBJC_ARC": "YES",
            "MACOSX_DEPLOYMENT_TARGET": "13.0"
          }
        }],
        ["OS=='win'", {
          "sources": ["src/win/window_watcher_win.cc"],
          "defines": ["UNICODE", "_UNICODE", "NOMINMAX", "WIN32_LEAN_AND_MEAN"],
          "libraries": ["dwmapi.lib", "version.lib", "user32.lib"],
          "msvs_settings": {
            "VCCLCompilerTool": { "AdditionalOptions": ["/std:c++20", "/utf-8"] }
          }
        }],
        ["OS!='mac' and OS!='win'", {
          "sources": ["src/stub/window_watcher_stub.cc"]
        }]
      ]
    }
  ]
}
