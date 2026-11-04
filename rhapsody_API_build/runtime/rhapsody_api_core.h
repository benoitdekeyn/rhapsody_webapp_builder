// Runtime core: instance registry + attribute / event operations used by the HTTP/WS server.
// It must not include any Rhapsody or Windows header.
#pragma once

#include <cstdint>
#include <string>
#include <utility>
#include <vector>

#include "rhapsody_api_desc.h"
#include "rhapsody_api_json.h"

namespace RhapsodyApi {

struct InstanceInfo {
    std::string id;         // "Class" for the first instance, "Class#N" for the following ones
    std::string className;
    bool reactive;
};

struct InstanceState {
    InstanceInfo info;
    std::vector<std::pair<std::string, std::string>> attrs;   // attribute -> JSON text
};

struct Result {
    bool ok = true;
    int status = 200;        // HTTP-like status code
    std::string error;
    std::string instance;    // resolved instance id
    Json value;
};

std::vector<InstanceInfo> listInstances();
std::vector<InstanceState> sampleAll();
Result sampleInstance(const std::string& idOrClass);
Result getAttribute(const std::string& idOrClass, const std::string& attr);
// index < 0 writes the whole attribute, otherwise a single element of an array attribute.
Result setAttribute(const std::string& idOrClass, const std::string& attr, const Json& value, int index);
// `instance` may be empty: the target is then deduced from the statecharts that handle the event.
Result sendEvent(const std::string& instance, const std::string& event, const Json& args);

// Incremented each time an instance is created or destroyed.
uint64_t instanceRevision();

} // namespace RhapsodyApi
