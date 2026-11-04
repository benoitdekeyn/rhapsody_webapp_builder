// JSON <-> C++ conversions used by the generated accessors (needs the Rhapsody headers
// for OMString: include it after them).
#pragma once

#include <cmath>
#include <limits>
#include <string>
#include <type_traits>

#include "rhapsody_api_json.h"

namespace RhapsodyApi {

template <class T>
struct IsNumeric : std::integral_constant<bool, std::is_arithmetic<T>::value && !std::is_same<T, bool>::value> {};

// ---- C++ -> JSON ------------------------------------------------------------

inline Json toJson(bool v) { return Json::boolean(v); }

template <class T>
typename std::enable_if<IsNumeric<T>::value, Json>::type toJson(const T& v) { return Json::number((double)v); }

template <class T>
typename std::enable_if<std::is_enum<T>::value, Json>::type toJson(const T& v) { return Json::number((double)static_cast<long long>(v)); }

inline Json toJson(const std::string& s) { return Json::string(s); }

inline Json toJson(const OMString& s) {
    const char* p = (const char*)const_cast<OMString&>(s);
    return Json::string(p ? p : "");
}

template <size_t N>
Json toJson(const char (&a)[N]) {
    size_t len = 0;
    while (len < N && a[len]) ++len;
    return Json::string(std::string(a, len));
}

template <class T, size_t N>
Json toJson(const T (&a)[N]) {
    Json arr = Json::array();
    for (size_t i = 0; i < N; ++i) arr.push(toJson(a[i]));
    return arr;
}

// ---- JSON -> C++ ------------------------------------------------------------

inline bool parseNumberText(const std::string& s, double& d) {
    if (s.empty()) return false;
    char* end = nullptr;
    d = std::strtod(s.c_str(), &end);
    return end && *end == '\0';
}

inline bool fromJson(bool& dst, const Json& v, std::string& err) {
    if (v.isBool()) { dst = v.asBool(); return true; }
    if (v.isNumber()) { dst = v.asNumber() != 0.0; return true; }
    if (v.isString()) {
        const std::string& s = v.asString();
        if (s == "true" || s == "1") { dst = true; return true; }
        if (s == "false" || s == "0") { dst = false; return true; }
    }
    err = "expected a boolean";
    return false;
}

template <class T>
typename std::enable_if<IsNumeric<T>::value, bool>::type fromJson(T& dst, const Json& v, std::string& err) {
    double d;
    if (v.isNumber()) d = v.asNumber();
    else if (v.isBool()) d = v.asBool() ? 1.0 : 0.0;
    else if (!(v.isString() && parseNumberText(v.asString(), d))) { err = "expected a number"; return false; }
    if (!std::isfinite(d)) { err = "expected a finite number"; return false; }
    if (std::is_integral<T>::value) {
        if (d != std::floor(d)) { err = "expected an integer"; return false; }
        if (d < (double)std::numeric_limits<T>::lowest() || d > (double)std::numeric_limits<T>::max()) {
            err = "value out of range";
            return false;
        }
    }
    dst = static_cast<T>(d);
    return true;
}

template <class T>
typename std::enable_if<std::is_enum<T>::value, bool>::type fromJson(T& dst, const Json& v, std::string& err) {
    long long n = 0;
    if (!fromJson(n, v, err)) return false;
    dst = static_cast<T>(n);
    return true;
}

inline bool fromJson(std::string& dst, const Json& v, std::string& err) {
    if (v.isString()) dst = v.asString();
    else if (v.isNull()) dst.clear();
    else if (v.isNumber() || v.isBool()) dst = v.dump();
    else { err = "expected a string"; return false; }
    return true;
}

inline bool fromJson(OMString& dst, const Json& v, std::string& err) {
    std::string s;
    if (!fromJson(s, v, err)) return false;
    dst = s.c_str();
    return true;
}

template <size_t N>
bool fromJson(char (&dst)[N], const Json& v, std::string& err) {
    std::string s;
    if (!fromJson(s, v, err)) return false;
    if (s.size() >= N) { err = "string too long (max " + std::to_string(N - 1) + " characters)"; return false; }
    for (size_t i = 0; i < s.size(); ++i) dst[i] = s[i];
    dst[s.size()] = '\0';
    return true;
}

template <class T, size_t N>
bool fromJson(T (&dst)[N], const Json& v, std::string& err) {
    if (!v.isArray() || v.size() != N) {
        err = "expected an array of " + std::to_string(N) + " elements";
        return false;
    }
    for (size_t i = 0; i < N; ++i) {
        std::string e;
        if (!fromJson(dst[i], v.values()[i], e)) { err = "element " + std::to_string(i) + ": " + e; return false; }
    }
    return true;
}

// ---- attribute writer (whole value or one array element) -----------------------------

template <class T>
bool setValue(T& dst, const Json& v, int index, std::string& err) {
    if (index >= 0) { err = "attribute is not an array"; return false; }
    return fromJson(dst, v, err);
}

template <size_t N>
bool setValue(char (&dst)[N], const Json& v, int index, std::string& err) {
    if (index >= 0) { err = "attribute is a string, not an array"; return false; }
    return fromJson(dst, v, err);
}

template <class T, size_t N>
bool setValue(T (&dst)[N], const Json& v, int index, std::string& err) {
    if (index < 0) return fromJson(dst, v, err);
    if ((size_t)index >= N) { err = "index out of range (length " + std::to_string(N) + ")"; return false; }
    return setValue(dst[index], v, -1, err);
}

// ---- event argument reader -------------------------------------------------------------

template <class T>
bool argFromJson(const Json& args, size_t i, const char* name, T& out, std::string& err) {
    std::string e;
    if (i >= args.size() || !fromJson(out, args.values()[i], e)) {
        err = std::string("argument '") + name + "': " + (i >= args.size() ? "missing" : e);
        return false;
    }
    return true;
}

} // namespace RhapsodyApi
