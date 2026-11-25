#pragma once

#include <cstdint>
#include <string>

namespace window_context {

#if defined(__APPLE__)
std::string RunAppleScript(const std::string& source);
#endif

#if defined(_WIN32)
std::string ExplorerFolder(int64_t hwnd, const std::string& title);
#endif

}
