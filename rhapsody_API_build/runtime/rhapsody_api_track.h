// Included by the generated headers: every API-exposed class owns a Tracker member that
// registers the instance at construction and unregisters it at destruction.
#pragma once

namespace RhapsodyApi {

void registerInstance(const char* className, void* object, void* reactive);
void unregisterInstance(void* object);

struct Tracker {
    // `reactive` is the OMReactive* of the instance (or null for non reactive classes).
    Tracker(const char* className, void* object, void* reactive) : object_(object) {
        registerInstance(className, object, reactive);
    }
    // Copies are different objects: they are not tracked.
    Tracker(const Tracker&) : object_(0) {}
    Tracker& operator=(const Tracker&) { return *this; }
    ~Tracker() { if (object_) unregisterInstance(object_); }

private:
    void* object_;
};

} // namespace RhapsodyApi
