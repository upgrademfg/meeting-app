#import <Foundation/Foundation.h>

#include <mutex>

#include "../context_reader.h"

namespace window_context {

std::string RunAppleScript(const std::string& source) {
  static std::mutex serial;
  std::lock_guard<std::mutex> lock(serial);
  @autoreleasepool {
    NSAppleScript* script = [[NSAppleScript alloc] initWithSource:@(source.c_str())];
    NSDictionary* error = nil;
    NSString* text = [script executeAndReturnError:&error].stringValue;
    return text ? std::string(text.UTF8String) : std::string();
  }
}

}
