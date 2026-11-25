#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>

#include "../window_watcher.h"

namespace window_events {
namespace {

const CFStringRef kWindowNotifications[] = {
    kAXTitleChangedNotification,
    kAXMovedNotification,
    kAXResizedNotification,
    kAXWindowMovedNotification,
    kAXWindowResizedNotification,
};

std::string ToStd(NSString* value) {
  const char* utf8 = value.UTF8String;
  return utf8 ? std::string(utf8) : std::string();
}

std::string CopyStringAttribute(AXUIElementRef element, CFStringRef attribute) {
  CFTypeRef value = nullptr;
  if (AXUIElementCopyAttributeValue(element, attribute, &value) != kAXErrorSuccess || !value) return {};
  std::string result;
  if (CFGetTypeID(value) == CFStringGetTypeID()) {
    result = ToStd((__bridge NSString*)value);
  } else if (CFGetTypeID(value) == CFURLGetTypeID()) {
    result = ToStd(((__bridge NSURL*)value).absoluteString);
  }
  CFRelease(value);
  return result;
}

std::optional<Bounds> CopyBounds(AXUIElementRef window) {
  CFTypeRef position = nullptr;
  CFTypeRef size = nullptr;
  std::optional<Bounds> result;
  if (AXUIElementCopyAttributeValue(window, kAXPositionAttribute, &position) == kAXErrorSuccess &&
      AXUIElementCopyAttributeValue(window, kAXSizeAttribute, &size) == kAXErrorSuccess) {
    CGPoint origin;
    CGSize extent;
    if (AXValueGetValue((AXValueRef)position, (AXValueType)kAXValueCGPointType, &origin) &&
        AXValueGetValue((AXValueRef)size, (AXValueType)kAXValueCGSizeType, &extent)) {
      result = Bounds{origin.x, origin.y, extent.width, extent.height};
    }
  }
  if (position) CFRelease(position);
  if (size) CFRelease(size);
  return result;
}

AXUIElementRef CopyFocusedWindow(AXUIElementRef app) {
  CFTypeRef window = nullptr;
  if (AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute, &window) != kAXErrorSuccess) return nullptr;
  return (AXUIElementRef)window;
}

WindowInfo Describe(NSRunningApplication* app) {
  WindowInfo info;
  info.pid = app.processIdentifier;
  info.app = ToStd(app.localizedName);
  info.app_path = ToStd(app.bundleURL.path ?: app.executableURL.path);
  info.bundle_id = ToStd(app.bundleIdentifier);
  AXUIElementRef app_element = AXUIElementCreateApplication(app.processIdentifier);
  if (AXUIElementRef window = CopyFocusedWindow(app_element)) {
    info.title = CopyStringAttribute(window, kAXTitleAttribute);
    info.document_url = CopyStringAttribute(window, kAXDocumentAttribute);
    info.bounds = CopyBounds(window);
    CFRelease(window);
  }
  CFRelease(app_element);
  return info;
}

void OnAccessibilityNotification(AXObserverRef, AXUIElementRef, CFStringRef notification, void* context);

class MacWindowWatcher final : public WindowWatcher {
 public:
  ~MacWindowWatcher() override { Stop(); }

  bool Start(WindowEventSink sink) override {
    sink_ = std::move(sink);
    MacWindowWatcher* watcher = this;
    activation_observer_ = [NSWorkspace.sharedWorkspace.notificationCenter
        addObserverForName:NSWorkspaceDidActivateApplicationNotification
                    object:nil
                     queue:NSOperationQueue.mainQueue
                usingBlock:^(NSNotification* note) {
                  NSRunningApplication* app = note.userInfo[NSWorkspaceApplicationKey];
                  watcher->ObserveApp(app);
                  watcher->Emit(WindowEventKind::kActivate, app);
                }];
    ObserveApp(NSWorkspace.sharedWorkspace.frontmostApplication);
    return true;
  }

  void Stop() override {
    if (activation_observer_) {
      [NSWorkspace.sharedWorkspace.notificationCenter removeObserver:activation_observer_];
      activation_observer_ = nil;
    }
    UnobserveApp();
    sink_ = nullptr;
  }

  std::optional<WindowInfo> ActiveWindow() override {
    NSRunningApplication* app = NSWorkspace.sharedWorkspace.frontmostApplication;
    if (!app) return std::nullopt;
    return Describe(app);
  }

  void HandleAccessibility(CFStringRef notification) {
    if (CFEqual(notification, kAXFocusedWindowChangedNotification)) {
      ObserveFocusedWindow();
      Emit(WindowEventKind::kTitle, NSWorkspace.sharedWorkspace.frontmostApplication);
    } else if (CFEqual(notification, kAXTitleChangedNotification)) {
      Emit(WindowEventKind::kTitle, NSWorkspace.sharedWorkspace.frontmostApplication);
    } else {
      Emit(WindowEventKind::kBounds, NSWorkspace.sharedWorkspace.frontmostApplication);
    }
  }

 private:
  void Emit(WindowEventKind kind, NSRunningApplication* app) {
    if (!sink_ || !app) return;
    sink_(WindowEvent{kind, Describe(app)});
  }

  void ObserveApp(NSRunningApplication* app) {
    UnobserveApp();
    if (!app || !AXIsProcessTrusted()) return;
    if (AXObserverCreate(app.processIdentifier, OnAccessibilityNotification, &observer_) != kAXErrorSuccess) {
      observer_ = nullptr;
      return;
    }
    app_element_ = AXUIElementCreateApplication(app.processIdentifier);
    AXObserverAddNotification(observer_, app_element_, kAXFocusedWindowChangedNotification, this);
    CFRunLoopAddSource(CFRunLoopGetMain(), AXObserverGetRunLoopSource(observer_), kCFRunLoopCommonModes);
    ObserveFocusedWindow();
  }

  void ObserveFocusedWindow() {
    UnobserveWindow();
    if (!observer_) return;
    window_element_ = CopyFocusedWindow(app_element_);
    if (!window_element_) return;
    for (CFStringRef notification : kWindowNotifications) {
      AXObserverAddNotification(observer_, window_element_, notification, this);
    }
  }

  void UnobserveWindow() {
    if (!window_element_) return;
    for (CFStringRef notification : kWindowNotifications) {
      AXObserverRemoveNotification(observer_, window_element_, notification);
    }
    CFRelease(window_element_);
    window_element_ = nullptr;
  }

  void UnobserveApp() {
    UnobserveWindow();
    if (observer_) {
      AXObserverRemoveNotification(observer_, app_element_, kAXFocusedWindowChangedNotification);
      CFRunLoopRemoveSource(CFRunLoopGetMain(), AXObserverGetRunLoopSource(observer_), kCFRunLoopCommonModes);
      CFRelease(observer_);
      observer_ = nullptr;
    }
    if (app_element_) {
      CFRelease(app_element_);
      app_element_ = nullptr;
    }
  }

  WindowEventSink sink_;
  id activation_observer_ = nil;
  AXObserverRef observer_ = nullptr;
  AXUIElementRef app_element_ = nullptr;
  AXUIElementRef window_element_ = nullptr;
};

void OnAccessibilityNotification(AXObserverRef, AXUIElementRef, CFStringRef notification, void* context) {
  static_cast<MacWindowWatcher*>(context)->HandleAccessibility(notification);
}

}

std::unique_ptr<WindowWatcher> CreateWindowWatcher() { return std::make_unique<MacWindowWatcher>(); }

}
