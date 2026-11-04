#include "rhapsody_api_core.h"

#include <cstring>
#include <map>
#include <mutex>

#include "rhapsody_api_track.h"

namespace RhapsodyApi {
namespace {

struct Instance {
    std::string id;
    const ClassDesc* cls;
    void* object;
    void* reactive;
    unsigned serial;
};

struct Registry {
    std::mutex mutex;
    std::vector<Instance> instances;
    std::map<std::string, unsigned> counters;
    uint64_t revision = 0;
};

// Never destroyed: model objects may be created / destroyed during static (de)initialization.
Registry& registry() {
    static Registry* r = new Registry();
    return *r;
}

const ClassDesc* findClass(const char* name) {
    const GeneratedApi& api = generatedApi();
    for (size_t i = 0; i < api.classCount; ++i) {
        if (std::strcmp(api.classes[i].name, name) == 0) return &api.classes[i];
    }
    return nullptr;
}

const AttrDesc* findAttr(const ClassDesc& cls, const std::string& name) {
    for (size_t i = 0; i < cls.attrCount; ++i) {
        if (name == cls.attrs[i].name) return &cls.attrs[i];
    }
    return nullptr;
}

const EventDesc* findEvent(const std::string& name) {
    const GeneratedApi& api = generatedApi();
    for (size_t i = 0; i < api.eventCount; ++i) {
        if (name == api.events[i].name) return &api.events[i];
    }
    return nullptr;
}

bool handles(const EventDesc& ev, const std::string& className) {
    for (size_t i = 0; i < ev.handledByCount; ++i) {
        if (className == ev.handledBy[i]) return true;
    }
    return false;
}

Result fail(int status, std::string message) {
    Result r;
    r.ok = false;
    r.status = status;
    r.error = std::move(message);
    return r;
}

// Registry mutex must be held.
const Instance* resolve(const std::string& idOrClass) {
    Registry& reg = registry();
    for (const Instance& i : reg.instances) {
        if (i.id == idOrClass) return &i;
    }
    const Instance* best = nullptr;
    for (const Instance& i : reg.instances) {
        if (idOrClass == i.cls->name && (!best || i.serial < best->serial)) best = &i;
    }
    return best;
}

InstanceInfo infoOf(const Instance& i) {
    return InstanceInfo{i.id, i.cls->name, i.reactive != nullptr};
}

// Reading an attribute can race with the model threads: never let an exception escape.
bool safeGet(const AttrDesc& a, void* object, std::string& out) {
    try {
        out = a.get(object).dump();
        return true;
    } catch (...) {
        return false;
    }
}

InstanceState sampleLocked(const Instance& inst) {
    InstanceState st;
    st.info = infoOf(inst);
    for (size_t i = 0; i < inst.cls->attrCount; ++i) {
        std::string text;
        if (safeGet(inst.cls->attrs[i], inst.object, text)) {
            st.attrs.emplace_back(inst.cls->attrs[i].name, std::move(text));
        }
    }
    return st;
}

} // namespace

void registerInstance(const char* className, void* object, void* reactive) {
    const ClassDesc* cls = findClass(className);
    if (!cls) return;
    Registry& reg = registry();
    std::lock_guard<std::mutex> lock(reg.mutex);
    unsigned serial = ++reg.counters[className];
    std::string id = serial == 1 ? std::string(className) : std::string(className) + "#" + std::to_string(serial);
    reg.instances.push_back(Instance{id, cls, object, reactive, serial});
    ++reg.revision;
}

void unregisterInstance(void* object) {
    Registry& reg = registry();
    std::lock_guard<std::mutex> lock(reg.mutex);
    for (size_t i = 0; i < reg.instances.size(); ++i) {
        if (reg.instances[i].object == object) {
            reg.instances.erase(reg.instances.begin() + (std::ptrdiff_t)i);
            ++reg.revision;
            return;
        }
    }
}

uint64_t instanceRevision() {
    Registry& reg = registry();
    std::lock_guard<std::mutex> lock(reg.mutex);
    return reg.revision;
}

std::vector<InstanceInfo> listInstances() {
    Registry& reg = registry();
    std::lock_guard<std::mutex> lock(reg.mutex);
    std::vector<InstanceInfo> out;
    for (const Instance& i : reg.instances) out.push_back(infoOf(i));
    return out;
}

std::vector<InstanceState> sampleAll() {
    Registry& reg = registry();
    std::lock_guard<std::mutex> lock(reg.mutex);
    std::vector<InstanceState> out;
    for (const Instance& i : reg.instances) out.push_back(sampleLocked(i));
    return out;
}

Result sampleInstance(const std::string& idOrClass) {
    Registry& reg = registry();
    std::lock_guard<std::mutex> lock(reg.mutex);
    const Instance* inst = resolve(idOrClass);
    if (!inst) return fail(404, "unknown instance '" + idOrClass + "'");
    InstanceState st = sampleLocked(*inst);
    Result r;
    r.instance = st.info.id;
    Json obj = Json::object();
    for (auto& kv : st.attrs) {
        Json v;
        std::string e;
        Json::parse(kv.second, v, e);
        obj.set(kv.first, std::move(v));
    }
    r.value = std::move(obj);
    return r;
}

Result getAttribute(const std::string& idOrClass, const std::string& attr) {
    Registry& reg = registry();
    std::lock_guard<std::mutex> lock(reg.mutex);
    const Instance* inst = resolve(idOrClass);
    if (!inst) return fail(404, "unknown instance '" + idOrClass + "'");
    const AttrDesc* a = findAttr(*inst->cls, attr);
    if (!a) return fail(404, "unknown attribute '" + attr + "' on " + inst->id);
    Result r;
    r.instance = inst->id;
    try {
        r.value = a->get(inst->object);
    } catch (...) {
        return fail(500, "failed to read attribute '" + attr + "'");
    }
    return r;
}

Result setAttribute(const std::string& idOrClass, const std::string& attr, const Json& value, int index) {
    Registry& reg = registry();
    std::lock_guard<std::mutex> lock(reg.mutex);
    const Instance* inst = resolve(idOrClass);
    if (!inst) return fail(404, "unknown instance '" + idOrClass + "'");
    const AttrDesc* a = findAttr(*inst->cls, attr);
    if (!a) return fail(404, "unknown attribute '" + attr + "' on " + inst->id);
    if (!a->writable || !a->set) return fail(403, "attribute '" + attr + "' is read-only");
    std::string err;
    try {
        if (!a->set(inst->object, value, index, err)) return fail(400, "attribute '" + attr + "': " + err);
        Result r;
        r.instance = inst->id;
        r.value = a->get(inst->object);
        return r;
    } catch (...) {
        return fail(500, "failed to write attribute '" + attr + "'");
    }
}

Result sendEvent(const std::string& instance, const std::string& eventName, const Json& argsIn) {
    const EventDesc* ev = findEvent(eventName);
    if (!ev) return fail(404, "unknown event '" + eventName + "'");

    // Normalize the arguments to a positional array.
    Json args = Json::array();
    if (argsIn.isArray()) {
        args = argsIn;
    } else if (argsIn.isObject()) {
        for (size_t i = 0; i < ev->argCount; ++i) {
            const Json* v = argsIn.find(ev->argNames[i]);
            if (!v) return fail(400, std::string("argument '") + ev->argNames[i] + "': missing");
            args.push(*v);
        }
    } else if (!argsIn.isNull()) {
        return fail(400, "args must be an object or an array");
    }
    if (args.size() != ev->argCount) {
        return fail(400, "event '" + eventName + "' expects " + std::to_string(ev->argCount) + " argument(s), got " + std::to_string(args.size()));
    }

    Registry& reg = registry();
    std::lock_guard<std::mutex> lock(reg.mutex);
    const Instance* target = nullptr;
    if (!instance.empty()) {
        target = resolve(instance);
        if (!target) return fail(404, "unknown instance '" + instance + "'");
        if (!target->reactive) return fail(400, "instance '" + target->id + "' is not reactive (cannot receive events)");
    } else {
        std::vector<const Instance*> handlers, reactives;
        for (const Instance& i : reg.instances) {
            if (!i.reactive) continue;
            reactives.push_back(&i);
            if (handles(*ev, i.cls->name)) handlers.push_back(&i);
        }
        const std::vector<const Instance*>& candidates = handlers.empty() ? reactives : handlers;
        if (candidates.size() == 1) {
            target = candidates[0];
        } else {
            std::string list;
            for (const Instance* i : candidates) list += (list.empty() ? "" : ", ") + i->id;
            return fail(400, candidates.empty() ? std::string("no reactive instance available")
                                                : "instance required, candidates: " + list);
        }
    }

    std::string err;
    try {
        if (!ev->send(target->reactive, args, err)) return fail(400, err.empty() ? std::string("event was not accepted") : err);
    } catch (...) {
        return fail(500, "failed to send event '" + eventName + "'");
    }
    Result r;
    r.instance = target->id;
    return r;
}

} // namespace RhapsodyApi
