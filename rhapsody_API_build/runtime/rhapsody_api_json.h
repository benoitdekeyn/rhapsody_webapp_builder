// Minimal JSON value / parser / serializer (header only, no dependency).
#pragma once

#include <charconv>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <utility>
#include <vector>

namespace RhapsodyApi {

class Json {
public:
    enum Type { Null, Bool, Number, String, Array, Object };

    Json() : type_(Null), num_(0), bool_(false) {}

    static Json boolean(bool v) { Json j; j.type_ = Bool; j.bool_ = v; return j; }
    static Json number(double v) { Json j; j.type_ = Number; j.num_ = v; return j; }
    static Json string(std::string v) { Json j; j.type_ = String; j.str_ = std::move(v); return j; }
    static Json array() { Json j; j.type_ = Array; return j; }
    static Json object() { Json j; j.type_ = Object; return j; }

    Type type() const { return type_; }
    bool isNull() const { return type_ == Null; }
    bool isBool() const { return type_ == Bool; }
    bool isNumber() const { return type_ == Number; }
    bool isString() const { return type_ == String; }
    bool isArray() const { return type_ == Array; }
    bool isObject() const { return type_ == Object; }

    bool asBool() const { return bool_; }
    double asNumber() const { return num_; }
    const std::string& asString() const { return str_; }

    // Array items / object values (same order as keys()).
    const std::vector<Json>& values() const { return vals_; }
    const std::vector<std::string>& keys() const { return keys_; }
    size_t size() const { return vals_.size(); }

    void push(Json v) { vals_.push_back(std::move(v)); }

    Json& set(const std::string& key, Json v) {
        for (size_t i = 0; i < keys_.size(); ++i) {
            if (keys_[i] == key) { vals_[i] = std::move(v); return vals_[i]; }
        }
        keys_.push_back(key);
        vals_.push_back(std::move(v));
        return vals_.back();
    }

    const Json* find(const std::string& key) const {
        if (type_ != Object) return nullptr;
        for (size_t i = 0; i < keys_.size(); ++i) {
            if (keys_[i] == key) return &vals_[i];
        }
        return nullptr;
    }

    std::string dump() const { std::string s; dumpTo(s); return s; }

    void dumpTo(std::string& out) const {
        switch (type_) {
        case Null: out += "null"; break;
        case Bool: out += bool_ ? "true" : "false"; break;
        case Number: appendNumber(out, num_); break;
        case String: appendQuoted(out, str_); break;
        case Array:
            out += '[';
            for (size_t i = 0; i < vals_.size(); ++i) {
                if (i) out += ',';
                vals_[i].dumpTo(out);
            }
            out += ']';
            break;
        case Object:
            out += '{';
            for (size_t i = 0; i < vals_.size(); ++i) {
                if (i) out += ',';
                appendQuoted(out, keys_[i]);
                out += ':';
                vals_[i].dumpTo(out);
            }
            out += '}';
            break;
        }
    }

    static std::string quote(const std::string& s) { std::string o; appendQuoted(o, s); return o; }

    static void appendNumber(std::string& out, double v) {
        if (!std::isfinite(v)) { out += "null"; return; }
        char buf[64];
        std::to_chars_result r = std::to_chars(buf, buf + sizeof(buf), v);
        out.append(buf, r.ptr);
    }

    // Strings coming from the model may be in a legacy 8-bit codepage: invalid UTF-8 bytes
    // are re-encoded as Latin-1 so the output is always valid JSON/UTF-8.
    static void appendQuoted(std::string& out, const std::string& s) {
        out += '"';
        size_t i = 0;
        while (i < s.size()) {
            unsigned char c = (unsigned char)s[i];
            if (c < 0x80) {
                switch (c) {
                case '"': out += "\\\""; break;
                case '\\': out += "\\\\"; break;
                case '\n': out += "\\n"; break;
                case '\r': out += "\\r"; break;
                case '\t': out += "\\t"; break;
                case '\b': out += "\\b"; break;
                case '\f': out += "\\f"; break;
                default:
                    if (c < 0x20) {
                        char b[8];
                        snprintf(b, sizeof(b), "\\u%04x", c);
                        out += b;
                    } else {
                        out += (char)c;
                    }
                }
                ++i;
                continue;
            }
            size_t len = utf8SequenceLength(s, i);
            if (len) {
                out.append(s, i, len);
                i += len;
            } else {
                appendUtf8(out, c);
                ++i;
            }
        }
        out += '"';
    }

    static bool parse(const std::string& text, Json& out, std::string& err) {
        Parser p{text, 0, 0, err};
        p.skipWs();
        if (!p.value(out)) return false;
        p.skipWs();
        if (p.pos != text.size()) { err = "unexpected trailing characters at offset " + std::to_string(p.pos); return false; }
        return true;
    }

private:
    Type type_;
    double num_;
    bool bool_;
    std::string str_;
    std::vector<std::string> keys_;
    std::vector<Json> vals_;

    static void appendUtf8(std::string& out, uint32_t cp) {
        if (cp < 0x80) out += (char)cp;
        else if (cp < 0x800) { out += (char)(0xC0 | (cp >> 6)); out += (char)(0x80 | (cp & 0x3F)); }
        else if (cp < 0x10000) { out += (char)(0xE0 | (cp >> 12)); out += (char)(0x80 | ((cp >> 6) & 0x3F)); out += (char)(0x80 | (cp & 0x3F)); }
        else { out += (char)(0xF0 | (cp >> 18)); out += (char)(0x80 | ((cp >> 12) & 0x3F)); out += (char)(0x80 | ((cp >> 6) & 0x3F)); out += (char)(0x80 | (cp & 0x3F)); }
    }

    // Length of a valid multi-byte UTF-8 sequence starting at s[i], or 0 if invalid.
    static size_t utf8SequenceLength(const std::string& s, size_t i) {
        unsigned char c = (unsigned char)s[i];
        size_t len = (c >= 0xC2 && c <= 0xDF) ? 2 : (c >= 0xE0 && c <= 0xEF) ? 3 : (c >= 0xF0 && c <= 0xF4) ? 4 : 0;
        if (!len || i + len > s.size()) return 0;
        for (size_t k = 1; k < len; ++k) {
            if (((unsigned char)s[i + k] & 0xC0) != 0x80) return 0;
        }
        return len;
    }

    struct Parser {
        const std::string& s;
        size_t pos;
        int depth;
        std::string& err;

        void skipWs() { while (pos < s.size() && (s[pos] == ' ' || s[pos] == '\t' || s[pos] == '\n' || s[pos] == '\r')) ++pos; }

        bool fail(const char* msg) { err = std::string(msg) + " at offset " + std::to_string(pos); return false; }

        bool value(Json& out) {
            if (pos >= s.size()) return fail("unexpected end of JSON");
            if (++depth > 64) return fail("JSON nested too deeply");
            bool ok = valueInner(out);
            --depth;
            return ok;
        }

        bool valueInner(Json& out) {
            char c = s[pos];
            if (c == '{') return object(out);
            if (c == '[') return array(out);
            if (c == '"') { std::string str; if (!stringLiteral(str)) return false; out = Json::string(std::move(str)); return true; }
            if (s.compare(pos, 4, "true") == 0) { pos += 4; out = Json::boolean(true); return true; }
            if (s.compare(pos, 5, "false") == 0) { pos += 5; out = Json::boolean(false); return true; }
            if (s.compare(pos, 4, "null") == 0) { pos += 4; out = Json(); return true; }
            return number(out);
        }

        bool number(Json& out) {
            size_t start = pos;
            if (pos < s.size() && (s[pos] == '-' || s[pos] == '+')) ++pos;
            while (pos < s.size() && ((s[pos] >= '0' && s[pos] <= '9') || s[pos] == '.' || s[pos] == 'e' || s[pos] == 'E' || s[pos] == '-' || s[pos] == '+')) ++pos;
            if (pos == start) return fail("unexpected character");
            std::string tok = s.substr(start, pos - start);
            char* end = nullptr;
            double v = std::strtod(tok.c_str(), &end);
            if (!end || *end != '\0') { pos = start; return fail("invalid number"); }
            out = Json::number(v);
            return true;
        }

        bool hex4(uint32_t& v) {
            if (pos + 4 > s.size()) return fail("invalid \\u escape");
            v = 0;
            for (int i = 0; i < 4; ++i) {
                char c = s[pos++];
                v <<= 4;
                if (c >= '0' && c <= '9') v |= (uint32_t)(c - '0');
                else if (c >= 'a' && c <= 'f') v |= (uint32_t)(c - 'a' + 10);
                else if (c >= 'A' && c <= 'F') v |= (uint32_t)(c - 'A' + 10);
                else return fail("invalid \\u escape");
            }
            return true;
        }

        bool stringLiteral(std::string& out) {
            ++pos; // opening quote
            while (pos < s.size()) {
                char c = s[pos++];
                if (c == '"') return true;
                if (c != '\\') { out += c; continue; }
                if (pos >= s.size()) break;
                char e = s[pos++];
                switch (e) {
                case '"': out += '"'; break;
                case '\\': out += '\\'; break;
                case '/': out += '/'; break;
                case 'b': out += '\b'; break;
                case 'f': out += '\f'; break;
                case 'n': out += '\n'; break;
                case 'r': out += '\r'; break;
                case 't': out += '\t'; break;
                case 'u': {
                    uint32_t cp;
                    if (!hex4(cp)) return false;
                    if (cp >= 0xD800 && cp <= 0xDBFF && s.compare(pos, 2, "\\u") == 0) {
                        pos += 2;
                        uint32_t lo;
                        if (!hex4(lo)) return false;
                        cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                    }
                    appendUtf8(out, cp);
                    break;
                }
                default: return fail("invalid escape sequence");
                }
            }
            return fail("unterminated string");
        }

        bool array(Json& out) {
            ++pos;
            out = Json::array();
            skipWs();
            if (pos < s.size() && s[pos] == ']') { ++pos; return true; }
            for (;;) {
                skipWs();
                Json item;
                if (!value(item)) return false;
                out.push(std::move(item));
                skipWs();
                if (pos >= s.size()) return fail("unterminated array");
                if (s[pos] == ',') { ++pos; continue; }
                if (s[pos] == ']') { ++pos; return true; }
                return fail("expected ',' or ']'");
            }
        }

        bool object(Json& out) {
            ++pos;
            out = Json::object();
            skipWs();
            if (pos < s.size() && s[pos] == '}') { ++pos; return true; }
            for (;;) {
                skipWs();
                if (pos >= s.size() || s[pos] != '"') return fail("expected string key");
                std::string key;
                if (!stringLiteral(key)) return false;
                skipWs();
                if (pos >= s.size() || s[pos] != ':') return fail("expected ':'");
                ++pos;
                skipWs();
                Json item;
                if (!value(item)) return false;
                out.set(key, std::move(item));
                skipWs();
                if (pos >= s.size()) return fail("unterminated object");
                if (s[pos] == ',') { ++pos; continue; }
                if (s[pos] == '}') { ++pos; return true; }
                return fail("expected ',' or '}'");
            }
        }
    };
};

} // namespace RhapsodyApi
