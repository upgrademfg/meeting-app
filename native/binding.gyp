{
  "target_defaults": {
    "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS", "NAPI_VERSION=8"],
    "cflags_cc": ["-std=c++20"],
    "conditions": [
      ["OS=='mac'", {
        "xcode_settings": {
          "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
          "CLANG_ENABLE_OBJC_ARC": "YES",
          "MACOSX_DEPLOYMENT_TARGET": "13.0"
        }
      }],
      ["OS=='win'", {
        "defines": ["UNICODE", "_UNICODE", "NOMINMAX", "WIN32_LEAN_AND_MEAN"],
        "msvs_settings": {
          "VCCLCompilerTool": { "AdditionalOptions": ["/std:c++20", "/utf-8"] }
        }
      }]
    ]
  },
  "targets": [
    {
      "target_name": "window_events",
      "sources": ["window_events/addon.cc"],
      "conditions": [
        ["OS=='mac'", {
          "sources": ["window_events/mac/window_watcher_mac.mm"],
          "link_settings": { "libraries": ["-framework AppKit", "-framework ApplicationServices"] }
        }],
        ["OS=='win'", {
          "sources": ["window_events/win/window_watcher_win.cc"],
          "libraries": ["dwmapi.lib", "version.lib", "user32.lib"]
        }],
        ["OS!='mac' and OS!='win'", {
          "sources": ["window_events/stub/window_watcher_stub.cc"]
        }]
      ]
    },
    {
      "target_name": "window_context",
      "sources": ["window_context/addon.cc"],
      "conditions": [
        ["OS=='mac'", {
          "sources": ["window_context/mac/apple_script.mm"],
          "link_settings": { "libraries": ["-framework Foundation"] }
        }],
        ["OS=='win'", {
          "sources": ["window_context/win/explorer_folder.cc"],
          "libraries": ["ole32.lib", "oleaut32.lib", "shell32.lib", "uuid.lib"]
        }]
      ]
    }
  ]
}
