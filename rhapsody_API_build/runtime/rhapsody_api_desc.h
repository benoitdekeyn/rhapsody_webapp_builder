// Descriptors produced by the generator (api_gen.cpp) and consumed by the runtime core.
#pragma once

#include <cstddef>
#include <string>

#include "rhapsody_api_json.h"

namespace RhapsodyApi {

struct AttrDesc {
    const char* name;
    bool writable;
    Json (*get)(void* object);
    // index < 0: whole attribute; index >= 0: one element of an array attribute.
    bool (*set)(void* object, const Json& value, int index, std::string& error);
};

struct EventDesc {
    const char* name;
    size_t argCount;
    const char* const* argNames;
    const char* const* handledBy;   // classes whose statechart reacts to the event (hint)
    size_t handledByCount;
    // `reactive` is the instance's OMReactive*; `args` is a positional JSON array.
    bool (*send)(void* reactive, const Json& args, std::string& error);
};

struct ClassDesc {
    const char* name;
    const AttrDesc* attrs;
    size_t attrCount;
};

struct GeneratedApi {
    const ClassDesc* classes;
    size_t classCount;
    const EventDesc* events;
    size_t eventCount;
    const char* schema;     // JSON text of the schema (same content as the timestamped file)
    size_t schemaLength;
    const char* host;
    int port;               // 0 disables the server
    int pushRateHz;
    const char* webDir;     // simple API page folder, relative to the executable
    const char* webRoute;   // its URL prefix (e.g. "/api")
    const char* customDir;  // custom website folder, relative to the executable
    const char* customRoute; // its URL prefix (e.g. "/custom")
    const char* token;      // empty: no authentication
    bool cors;
    bool useExeDir;
};

const GeneratedApi& generatedApi();

} // namespace RhapsodyApi
