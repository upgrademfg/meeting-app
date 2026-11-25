#include <windows.h>
#include <exdisp.h>
#include <servprov.h>
#include <shlguid.h>
#include <shlobj.h>
#include <wrl/client.h>

#include "../context_reader.h"

namespace window_context {
namespace {

using Microsoft::WRL::ComPtr;

std::wstring ToWide(const std::string& value) {
  if (value.empty()) return {};
  int length = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
  std::wstring result(length, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), length);
  return result;
}

std::string ToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  int length = WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  std::string result(length, '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), length, nullptr, nullptr);
  return result;
}

std::wstring FolderPath(IDispatch* item) {
  ComPtr<IServiceProvider> provider;
  if (FAILED(item->QueryInterface(IID_PPV_ARGS(&provider)))) return {};
  ComPtr<IShellBrowser> browser;
  if (FAILED(provider->QueryService(SID_STopLevelBrowser, IID_PPV_ARGS(&browser)))) return {};
  ComPtr<IShellView> view;
  if (FAILED(browser->QueryActiveShellView(&view))) return {};
  ComPtr<IFolderView> folder_view;
  if (FAILED(view.As(&folder_view))) return {};
  ComPtr<IPersistFolder2> folder;
  if (FAILED(folder_view->GetFolder(IID_PPV_ARGS(&folder)))) return {};
  PIDLIST_ABSOLUTE pidl = nullptr;
  if (FAILED(folder->GetCurFolder(&pidl))) return {};
  std::wstring result;
  PWSTR path = nullptr;
  if (SUCCEEDED(SHGetNameFromIDList(pidl, SIGDN_FILESYSPATH, &path))) {
    result = path;
    CoTaskMemFree(path);
  }
  CoTaskMemFree(pidl);
  return result;
}

std::wstring FindFolder(int64_t hwnd, const std::wstring& title) {
  ComPtr<IShellWindows> windows;
  if (FAILED(CoCreateInstance(CLSID_ShellWindows, nullptr, CLSCTX_ALL, IID_PPV_ARGS(&windows)))) return {};
  long count = 0;
  windows->get_Count(&count);
  std::wstring fallback;
  for (long i = 0; i < count; ++i) {
    VARIANT index;
    VariantInit(&index);
    index.vt = VT_I4;
    index.lVal = i;
    ComPtr<IDispatch> item;
    if (FAILED(windows->Item(index, &item)) || !item) continue;
    ComPtr<IWebBrowserApp> browser;
    if (FAILED(item.As(&browser))) continue;
    SHANDLE_PTR handle = 0;
    if (FAILED(browser->get_HWND(&handle)) || static_cast<int64_t>(handle) != hwnd) continue;
    std::wstring path = FolderPath(item.Get());
    if (path.empty()) continue;
    BSTR name = nullptr;
    bool same_tab = false;
    if (SUCCEEDED(browser->get_LocationName(&name)) && name) {
      same_tab = !title.empty() && title.rfind(name, 0) == 0;
      SysFreeString(name);
    }
    if (same_tab) return path;
    if (fallback.empty()) fallback = path;
  }
  return fallback;
}

}

std::string ExplorerFolder(int64_t hwnd, const std::string& title) {
  HRESULT initialized = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  std::wstring path = FindFolder(hwnd, ToWide(title));
  if (SUCCEEDED(initialized)) CoUninitialize();
  return ToUtf8(path);
}

}
