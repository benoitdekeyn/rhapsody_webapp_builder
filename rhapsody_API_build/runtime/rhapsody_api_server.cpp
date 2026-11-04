// HTTP + WebSocket server embedded in the simulator. Starts automatically before main()
// (static initialization), so the model's own main() does not need to be modified.
// This file must not include any Rhapsody header (winsock2.h has to come before windows.h).

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <map>
#include <memory>
#include <mutex>
#include <sstream>
#include <thread>

#include "rhapsody_api_core.h"

#pragma comment(lib, "ws2_32.lib")

namespace RhapsodyApi {
namespace {

// ============================================================================
// Small helpers: SHA-1, Base64, URL decoding, time
// ============================================================================

std::string sha1(const std::string& data) {
    uint32_t h[5] = {0x67452301u, 0xEFCDAB89u, 0x98BADCFEu, 0x10325476u, 0xC3D2E1F0u};
    std::string msg = data;
    uint64_t bitLen = (uint64_t)data.size() * 8;
    msg += (char)0x80;
    while (msg.size() % 64 != 56) msg += (char)0;
    for (int i = 7; i >= 0; --i) msg += (char)((bitLen >> (i * 8)) & 0xFF);
    auto rol = [](uint32_t v, int n) { return (v << n) | (v >> (32 - n)); };
    for (size_t chunk = 0; chunk < msg.size(); chunk += 64) {
        uint32_t w[80];
        for (int i = 0; i < 16; ++i) {
            w[i] = ((uint32_t)(unsigned char)msg[chunk + i * 4] << 24) | ((uint32_t)(unsigned char)msg[chunk + i * 4 + 1] << 16) |
                   ((uint32_t)(unsigned char)msg[chunk + i * 4 + 2] << 8) | (uint32_t)(unsigned char)msg[chunk + i * 4 + 3];
        }
        for (int i = 16; i < 80; ++i) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
        uint32_t a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
        for (int i = 0; i < 80; ++i) {
            uint32_t f, k;
            if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999u; }
            else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1u; }
            else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDCu; }
            else { f = b ^ c ^ d; k = 0xCA62C1D6u; }
            uint32_t t = rol(a, 5) + f + e + k + w[i];
            e = d; d = c; c = rol(b, 30); b = a; a = t;
        }
        h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e;
    }
    std::string out;
    for (int i = 0; i < 5; ++i) for (int j = 3; j >= 0; --j) out += (char)((h[i] >> (j * 8)) & 0xFF);
    return out;
}

std::string base64(const std::string& in) {
    static const char* tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    size_t i = 0;
    for (; i + 2 < in.size(); i += 3) {
        uint32_t n = ((unsigned char)in[i] << 16) | ((unsigned char)in[i + 1] << 8) | (unsigned char)in[i + 2];
        out += tbl[(n >> 18) & 63]; out += tbl[(n >> 12) & 63]; out += tbl[(n >> 6) & 63]; out += tbl[n & 63];
    }
    if (i + 1 == in.size()) {
        uint32_t n = (unsigned char)in[i] << 16;
        out += tbl[(n >> 18) & 63]; out += tbl[(n >> 12) & 63]; out += "==";
    } else if (i + 2 == in.size()) {
        uint32_t n = ((unsigned char)in[i] << 16) | ((unsigned char)in[i + 1] << 8);
        out += tbl[(n >> 18) & 63]; out += tbl[(n >> 12) & 63]; out += tbl[(n >> 6) & 63]; out += '=';
    }
    return out;
}

std::string urlDecode(const std::string& s) {
    std::string out;
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '%' && i + 2 < s.size() && isxdigit((unsigned char)s[i + 1]) && isxdigit((unsigned char)s[i + 2])) {
            out += (char)std::strtol(s.substr(i + 1, 2).c_str(), nullptr, 16);
            i += 2;
        } else if (s[i] == '+') {
            out += ' ';
        } else {
            out += s[i];
        }
    }
    return out;
}

std::string lower(std::string s) {
    for (char& c : s) c = (char)tolower((unsigned char)c);
    return s;
}

int64_t nowMs() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
}

const std::chrono::steady_clock::time_point g_start = std::chrono::steady_clock::now();

std::string exeDir() {
    char buf[MAX_PATH];
    DWORD n = GetModuleFileNameA(nullptr, buf, MAX_PATH);
    std::string p(buf, n);
    size_t slash = p.find_last_of("\\/");
    return slash == std::string::npos ? "." : p.substr(0, slash);
}

// ============================================================================
// Sockets
// ============================================================================

bool sendAll(SOCKET s, const char* p, size_t n) {
    while (n > 0) {
        int r = send(s, p, (int)std::min<size_t>(n, 1 << 20), 0);
        if (r <= 0) return false;
        p += r;
        n -= (size_t)r;
    }
    return true;
}

bool recvExact(SOCKET s, char* p, size_t n) {
    while (n > 0) {
        int r = recv(s, p, (int)std::min<size_t>(n, 1 << 20), 0);
        if (r <= 0) return false;
        p += r;
        n -= (size_t)r;
    }
    return true;
}

// ============================================================================
// HTTP
// ============================================================================

struct Request {
    std::string method, path, query, body;
    std::map<std::string, std::string> headers;   // lower-case names
    std::map<std::string, std::string> params;    // decoded query string
};

struct Response {
    int status = 200;
    std::string contentType = "application/json; charset=utf-8";
    std::string body;
    std::string location;   // set for redirects
};

const char* statusText(int s) {
    switch (s) {
    case 200: return "OK";
    case 204: return "No Content";
    case 207: return "Multi-Status";
    case 302: return "Found";
    case 400: return "Bad Request";
    case 401: return "Unauthorized";
    case 403: return "Forbidden";
    case 404: return "Not Found";
    case 405: return "Method Not Allowed";
    case 413: return "Payload Too Large";
    default: return "Internal Server Error";
    }
}

bool readRequest(SOCKET s, std::string& buf, Request& req, int& err) {
    err = 0;
    size_t headerEnd;
    while ((headerEnd = buf.find("\r\n\r\n")) == std::string::npos) {
        if (buf.size() > 65536) { err = 413; return false; }
        char tmp[4096];
        int r = recv(s, tmp, sizeof(tmp), 0);
        if (r <= 0) return false;
        buf.append(tmp, (size_t)r);
    }
    std::istringstream head(buf.substr(0, headerEnd));
    std::string line;
    std::getline(head, line);
    std::istringstream first(line);
    std::string target, version;
    first >> req.method >> target >> version;
    if (req.method.empty() || target.empty()) { err = 400; return false; }
    size_t q = target.find('?');
    req.path = target.substr(0, q);
    req.query = q == std::string::npos ? "" : target.substr(q + 1);
    req.headers.clear();
    req.params.clear();
    while (std::getline(head, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        size_t c = line.find(':');
        if (c == std::string::npos) continue;
        std::string v = line.substr(c + 1);
        size_t b = v.find_first_not_of(" \t");
        req.headers[lower(line.substr(0, c))] = b == std::string::npos ? "" : v.substr(b);
    }
    size_t pos = 0;
    while (pos < req.query.size()) {
        size_t amp = req.query.find('&', pos);
        std::string kv = req.query.substr(pos, amp == std::string::npos ? std::string::npos : amp - pos);
        size_t eq = kv.find('=');
        req.params[urlDecode(kv.substr(0, eq))] = eq == std::string::npos ? "" : urlDecode(kv.substr(eq + 1));
        if (amp == std::string::npos) break;
        pos = amp + 1;
    }
    size_t length = 0;
    auto cl = req.headers.find("content-length");
    if (cl != req.headers.end()) length = (size_t)std::strtoull(cl->second.c_str(), nullptr, 10);
    if (length > (1u << 20)) { err = 413; return false; }
    size_t total = headerEnd + 4 + length;
    while (buf.size() < total) {
        char tmp[4096];
        int r = recv(s, tmp, sizeof(tmp), 0);
        if (r <= 0) return false;
        buf.append(tmp, (size_t)r);
    }
    req.body = buf.substr(headerEnd + 4, length);
    buf.erase(0, total);
    return true;
}

void sendResponse(SOCKET s, const Response& r, bool keepAlive, bool cors) {
    std::ostringstream h;
    h << "HTTP/1.1 " << r.status << ' ' << statusText(r.status) << "\r\n";
    if (r.status != 204) h << "Content-Type: " << r.contentType << "\r\n";
    h << "Content-Length: " << r.body.size() << "\r\n";
    h << "Cache-Control: no-store\r\n";
    if (!r.location.empty()) h << "Location: " << r.location << "\r\n";
    if (cors) {
        h << "Access-Control-Allow-Origin: *\r\n";
        h << "Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS\r\n";
        h << "Access-Control-Allow-Headers: Content-Type, Authorization\r\n";
    }
    h << "Connection: " << (keepAlive ? "keep-alive" : "close") << "\r\n\r\n";
    std::string head = h.str();
    if (sendAll(s, head.data(), head.size()) && !r.body.empty()) sendAll(s, r.body.data(), r.body.size());
}

Response jsonResponse(int status, const std::string& body) {
    Response r;
    r.status = status;
    r.body = body;
    return r;
}

Response errorResponse(int status, const std::string& message) {
    return jsonResponse(status, "{\"ok\":false,\"error\":" + Json::quote(message) + "}");
}

// ============================================================================
// Hub: live state diffing + WebSocket clients
// ============================================================================

struct WsClient {
    SOCKET sock;
    std::mutex sendMutex;
    std::atomic<bool> alive{true};
};

struct Hub {
    std::mutex mutex;   // protects clients, last, lastInfos, seq
    std::vector<std::shared_ptr<WsClient>> clients;
    std::map<std::string, std::map<std::string, std::string>> last;
    std::map<std::string, InstanceInfo> lastInfos;
    uint64_t seq = 0;
};

Hub& hub() {
    static Hub* h = new Hub();
    return *h;
}

std::string infoJson(const InstanceInfo& i) {
    return "{\"id\":" + Json::quote(i.id) + ",\"class\":" + Json::quote(i.className) + ",\"reactive\":" + (i.reactive ? "true" : "false") + "}";
}

std::string attrsJson(const std::map<std::string, std::string>& attrs) {
    std::string out = "{";
    bool first = true;
    for (const auto& kv : attrs) {
        if (!first) out += ',';
        first = false;
        out += Json::quote(kv.first) + ":" + kv.second;
    }
    return out + "}";
}

bool sendFrame(WsClient& c, unsigned char opcode, const std::string& payload) {
    std::string frame;
    frame += (char)(0x80 | opcode);
    if (payload.size() < 126) {
        frame += (char)payload.size();
    } else if (payload.size() <= 0xFFFF) {
        frame += (char)126;
        frame += (char)((payload.size() >> 8) & 0xFF);
        frame += (char)(payload.size() & 0xFF);
    } else {
        frame += (char)127;
        for (int i = 7; i >= 0; --i) frame += (char)(((uint64_t)payload.size() >> (i * 8)) & 0xFF);
    }
    frame += payload;
    std::lock_guard<std::mutex> lock(c.sendMutex);
    if (!c.alive) return false;
    if (!sendAll(c.sock, frame.data(), frame.size())) { c.alive = false; return false; }
    return true;
}

// hub().mutex must be held.
void broadcastLocked(const std::string& message) {
    Hub& h = hub();
    for (auto& c : h.clients) sendFrame(*c, 0x1, message);
    h.clients.erase(std::remove_if(h.clients.begin(), h.clients.end(), [](const std::shared_ptr<WsClient>& c) { return !c->alive; }), h.clients.end());
}

// Samples the model, updates the "last known" state and returns a delta message ("" if nothing changed).
// hub().mutex must be held.
std::string tickLocked() {
    Hub& h = hub();
    std::vector<InstanceState> states = sampleAll();
    std::map<std::string, std::map<std::string, std::string>> cur;
    std::map<std::string, InstanceInfo> infos;
    std::string added, changes, removed;
    for (const InstanceState& st : states) {
        std::map<std::string, std::string> attrs(st.attrs.begin(), st.attrs.end());
        auto prev = h.last.find(st.info.id);
        bool isNew = prev == h.last.end();
        std::map<std::string, std::string> diff;
        for (const auto& kv : attrs) {
            if (isNew || prev->second[kv.first] != kv.second) diff[kv.first] = kv.second;
        }
        if (isNew) added += (added.empty() ? "" : ",") + infoJson(st.info);
        if (!diff.empty()) changes += (changes.empty() ? "" : ",") + Json::quote(st.info.id) + ":" + attrsJson(diff);
        infos[st.info.id] = st.info;
        cur[st.info.id] = std::move(attrs);
    }
    for (const auto& kv : h.last) {
        if (!cur.count(kv.first)) removed += (removed.empty() ? "" : ",") + Json::quote(kv.first);
    }
    h.last = std::move(cur);
    h.lastInfos = std::move(infos);
    if (added.empty() && changes.empty() && removed.empty()) return "";
    ++h.seq;
    return "{\"type\":\"delta\",\"seq\":" + std::to_string(h.seq) + ",\"t\":" + std::to_string(nowMs()) +
           ",\"added\":[" + added + "],\"removed\":[" + removed + "],\"changes\":{" + changes + "}}";
}

// hub().mutex must be held (uses the state of the last tick).
std::string snapshotLocked() {
    Hub& h = hub();
    std::string instances, state;
    for (const auto& kv : h.lastInfos) {
        instances += (instances.empty() ? "" : ",") + infoJson(kv.second);
        state += (state.empty() ? "" : ",") + Json::quote(kv.first) + ":" + attrsJson(h.last[kv.first]);
    }
    return "{\"type\":\"snapshot\",\"seq\":" + std::to_string(h.seq) + ",\"t\":" + std::to_string(nowMs()) +
           ",\"instances\":[" + instances + "],\"state\":{" + state + "}}";
}

// Pushes pending changes to the WebSocket clients right away (used after a write).
void flushNow() {
    Hub& h = hub();
    std::lock_guard<std::mutex> lock(h.mutex);
    if (h.clients.empty()) return;
    std::string msg = tickLocked();
    if (!msg.empty()) broadcastLocked(msg);
}

void broadcastEvent(const std::string& instance, const std::string& name, const Json& args) {
    Hub& h = hub();
    std::lock_guard<std::mutex> lock(h.mutex);
    if (h.clients.empty()) return;
    broadcastLocked("{\"type\":\"event\",\"t\":" + std::to_string(nowMs()) + ",\"instance\":" + Json::quote(instance) +
                    ",\"name\":" + Json::quote(name) + ",\"args\":" + args.dump() + "}");
}

void broadcasterLoop(int hz) {
    const auto period = std::chrono::milliseconds(std::max(1, 1000 / std::max(1, hz)));
    for (;;) {
        std::this_thread::sleep_for(period);
        Hub& h = hub();
        std::lock_guard<std::mutex> lock(h.mutex);
        if (h.clients.empty()) continue;
        std::string msg = tickLocked();
        if (!msg.empty()) broadcastLocked(msg);
    }
}

// ============================================================================
// Operations shared by REST and WebSocket
// ============================================================================

// changes: { instance: { attr: value, ... }, ... }
Json applyChanges(const Json& changes, int& status) {
    Json results = Json::array();
    bool allOk = true;
    if (!changes.isObject()) {
        status = 400;
        Json r = Json::object();
        r.set("ok", Json::boolean(false));
        r.set("error", Json::string("'changes' must be an object { instance: { attribute: value } }"));
        return r;
    }
    for (size_t i = 0; i < changes.size(); ++i) {
        const std::string& inst = changes.keys()[i];
        const Json& attrs = changes.values()[i];
        if (!attrs.isObject()) { allOk = false; Json e = Json::object(); e.set("instance", Json::string(inst)); e.set("ok", Json::boolean(false)); e.set("error", Json::string("expected an object of attributes")); results.push(e); continue; }
        for (size_t k = 0; k < attrs.size(); ++k) {
            Result r = setAttribute(inst, attrs.keys()[k], attrs.values()[k], -1);
            Json e = Json::object();
            e.set("instance", Json::string(r.ok ? r.instance : inst));
            e.set("attr", Json::string(attrs.keys()[k]));
            e.set("ok", Json::boolean(r.ok));
            if (r.ok) e.set("value", r.value); else { e.set("error", Json::string(r.error)); allOk = false; }
            results.push(std::move(e));
        }
    }
    status = allOk ? 200 : 207;
    Json out = Json::object();
    out.set("ok", Json::boolean(allOk));
    out.set("results", std::move(results));
    return out;
}

// Accepts args directly (object / array) or wrapped as { "instance": ..., "args": ... }.
void splitEventBody(const Json& body, std::string& instance, Json& args) {
    args = body;
    if (body.isObject()) {
        const Json* a = body.find("args");
        const Json* i = body.find("instance");
        size_t known = (a ? 1 : 0) + (i ? 1 : 0);
        if ((a || i) && known == body.size()) {
            if (i && i->isString()) instance = i->asString();
            args = a ? *a : Json();
        }
    }
}

Json eventReply(const Result& r) {
    Json out = Json::object();
    out.set("ok", Json::boolean(r.ok));
    if (r.ok) out.set("instance", Json::string(r.instance));
    else out.set("error", Json::string(r.error));
    return out;
}

// ============================================================================
// REST routing
// ============================================================================

bool parseBody(const Request& req, Json& out, std::string& err) {
    if (req.body.find_first_not_of(" \t\r\n") == std::string::npos) { out = Json(); return true; }
    return Json::parse(req.body, out, err);
}

std::vector<std::string> splitPath(const std::string& path) {
    std::vector<std::string> parts;
    size_t pos = 0;
    while (pos <= path.size()) {
        size_t slash = path.find('/', pos);
        std::string seg = path.substr(pos, slash == std::string::npos ? std::string::npos : slash - pos);
        if (!seg.empty()) parts.push_back(urlDecode(seg));
        if (slash == std::string::npos) break;
        pos = slash + 1;
    }
    return parts;
}

Response fromResult(const Result& r, const std::string& okBody) {
    if (!r.ok) return errorResponse(r.status, r.error);
    return jsonResponse(200, okBody);
}

// Reset = the executable starts a fresh copy of itself (same command line and working
// directory) and terminates. The new process waits for this one to exit so the port is free,
// then the model starts again from its initial state. Clients simply reconnect.
std::atomic<bool> g_restarting(false);

bool relaunchSelf() {
    wchar_t exe[2 * MAX_PATH];
    DWORD n = GetModuleFileNameW(nullptr, exe, (DWORD)(sizeof(exe) / sizeof(exe[0])));
    if (n == 0 || n >= sizeof(exe) / sizeof(exe[0])) return false;
    std::wstring cmd = GetCommandLineW();
    SetEnvironmentVariableW(L"RHAPSODY_API_WAIT_PID", std::to_wstring(GetCurrentProcessId()).c_str());
    STARTUPINFOW si{};
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};
    BOOL ok = CreateProcessW(exe, &cmd[0], nullptr, nullptr, FALSE, 0, nullptr, nullptr, &si, &pi);
    SetEnvironmentVariableW(L"RHAPSODY_API_WAIT_PID", nullptr);
    if (ok) { CloseHandle(pi.hThread); CloseHandle(pi.hProcess); }
    return ok != FALSE;
}

// Returns false when a reset is already in progress. The reply is sent before the process ends.
bool scheduleReset() {
    if (g_restarting.exchange(true)) return false;
    std::thread([]() {
        Sleep(300);
        std::printf("[API] reset requested: restarting the simulation\n");
        std::fflush(stdout);
        if (!relaunchSelf()) {
            std::printf("[API] ERROR: cannot restart the simulation (CreateProcess failed)\n");
            std::fflush(stdout);
            g_restarting = false;
            return;
        }
        TerminateProcess(GetCurrentProcess(), 0);
    }).detach();
    return true;
}

Response routeApi(const Request& req, const std::vector<std::string>& seg) {
    const GeneratedApi& api = generatedApi();
    const std::string& m = req.method;
    // seg[0] == "api"
    if (m == "POST" && ((seg.size() == 2 && seg[1] == "reset") || (seg.size() == 3 && seg[1] == "simulation" && seg[2] == "reset"))) {
        if (!scheduleReset()) return errorResponse(409, "a reset is already in progress");
        return jsonResponse(200, "{\"ok\":true,\"restarting\":true}");
    }
    if (seg.size() == 2 && seg[1] == "health" && m == "GET") {
        size_t clients;
        { std::lock_guard<std::mutex> l(hub().mutex); clients = hub().clients.size(); }
        auto up = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - g_start).count();
        return jsonResponse(200, "{\"ok\":true,\"uptimeMs\":" + std::to_string(up) + ",\"instances\":" + std::to_string(listInstances().size()) +
                                     ",\"wsClients\":" + std::to_string(clients) + "}");
    }
    if (seg.size() == 2 && seg[1] == "schema" && m == "GET") return jsonResponse(200, std::string(api.schema, api.schemaLength));
    if (seg.size() == 2 && seg[1] == "instances" && m == "GET") {
        std::string out = "[";
        bool first = true;
        for (const InstanceInfo& i : listInstances()) { out += (first ? "" : ",") + infoJson(i); first = false; }
        return jsonResponse(200, out + "]");
    }
    if (seg.size() == 2 && seg[1] == "state") {
        if (m == "GET") {
            std::string instances, state;
            for (const InstanceState& st : sampleAll()) {
                instances += (instances.empty() ? "" : ",") + infoJson(st.info);
                state += (state.empty() ? "" : ",") + Json::quote(st.info.id) + ":" + attrsJson(std::map<std::string, std::string>(st.attrs.begin(), st.attrs.end()));
            }
            uint64_t seq;
            { std::lock_guard<std::mutex> l(hub().mutex); seq = hub().seq; }
            return jsonResponse(200, "{\"seq\":" + std::to_string(seq) + ",\"t\":" + std::to_string(nowMs()) + ",\"instances\":[" + instances + "],\"state\":{" + state + "}}");
        }
        if (m == "PATCH" || m == "PUT" || m == "POST") {
            Json body; std::string err;
            if (!parseBody(req, body, err)) return errorResponse(400, "invalid JSON: " + err);
            int status;
            Json out = applyChanges(body, status);
            flushNow();
            return jsonResponse(status, out.dump());
        }
        return errorResponse(405, "method not allowed");
    }
    if (seg.size() == 3 && seg[1] == "events" && m == "POST") {
        Json body, args; std::string err, instance;
        if (!parseBody(req, body, err)) return errorResponse(400, "invalid JSON: " + err);
        splitEventBody(body, instance, args);
        Result r = sendEvent(instance, seg[2], args);
        if (!r.ok) return errorResponse(r.status, r.error);
        broadcastEvent(r.instance, seg[2], args);
        flushNow();
        return jsonResponse(200, eventReply(r).dump());
    }
    if (seg.size() >= 3 && seg[1] == "instances") {
        const std::string& id = seg[2];
        if (seg.size() == 3 && m == "GET") {
            Result r = sampleInstance(id);
            if (!r.ok) return errorResponse(r.status, r.error);
            Json out = Json::object();
            out.set("id", Json::string(r.instance));
            out.set("attrs", r.value);
            return jsonResponse(200, out.dump());
        }
        if (seg.size() == 4 && seg[3] == "attrs" && (m == "PATCH" || m == "PUT" || m == "POST")) {
            Json body; std::string err;
            if (!parseBody(req, body, err)) return errorResponse(400, "invalid JSON: " + err);
            Json changes = Json::object();
            changes.set(id, body);
            int status;
            Json out = applyChanges(changes, status);
            flushNow();
            return jsonResponse(status, out.dump());
        }
        if (seg.size() == 5 && seg[3] == "attrs") {
            if (m == "GET") {
                Result r = getAttribute(id, seg[4]);
                return fromResult(r, "{\"instance\":" + Json::quote(r.instance) + ",\"attr\":" + Json::quote(seg[4]) + ",\"value\":" + r.value.dump() + "}");
            }
            if (m == "PUT" || m == "POST" || m == "PATCH") {
                Json body; std::string err;
                if (!parseBody(req, body, err)) return errorResponse(400, "invalid JSON: " + err);
                const Json* v = body.find("value");
                if (!v) return errorResponse(400, "body must be {\"value\": ...} (optional \"index\" for array elements)");
                const Json* idx = body.find("index");
                Result r = setAttribute(id, seg[4], *v, idx && idx->isNumber() ? (int)idx->asNumber() : -1);
                flushNow();
                return fromResult(r, "{\"ok\":true,\"instance\":" + Json::quote(r.instance) + ",\"attr\":" + Json::quote(seg[4]) + ",\"value\":" + r.value.dump() + "}");
            }
        }
        if (seg.size() == 5 && seg[3] == "events" && m == "POST") {
            Json body, args; std::string err, instance = id;
            if (!parseBody(req, body, err)) return errorResponse(400, "invalid JSON: " + err);
            std::string ignored;
            splitEventBody(body, ignored, args);
            Result r = sendEvent(instance, seg[4], args);
            if (!r.ok) return errorResponse(r.status, r.error);
            broadcastEvent(r.instance, seg[4], args);
            flushNow();
            return jsonResponse(200, eventReply(r).dump());
        }
    }
    return errorResponse(404, "unknown API route: " + m + " " + req.path);
}

const char* mimeType(const std::string& path) {
    size_t dot = path.find_last_of('.');
    std::string ext = dot == std::string::npos ? "" : lower(path.substr(dot));
    if (ext == ".html" || ext == ".htm") return "text/html; charset=utf-8";
    if (ext == ".js" || ext == ".mjs") return "text/javascript; charset=utf-8";
    if (ext == ".css") return "text/css; charset=utf-8";
    if (ext == ".json") return "application/json; charset=utf-8";
    if (ext == ".svg") return "image/svg+xml";
    if (ext == ".png") return "image/png";
    if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
    if (ext == ".gif") return "image/gif";
    if (ext == ".ico") return "image/x-icon";
    if (ext == ".wav") return "audio/wav";
    if (ext == ".mp3") return "audio/mpeg";
    if (ext == ".ogg") return "audio/ogg";
    if (ext == ".mp4") return "video/mp4";
    if (ext == ".webm") return "video/webm";
    if (ext == ".webp") return "image/webp";
    if (ext == ".avif") return "image/avif";
    if (ext == ".bmp") return "image/bmp";
    if (ext == ".woff") return "font/woff";
    if (ext == ".woff2") return "font/woff2";
    if (ext == ".ttf") return "font/ttf";
    if (ext == ".otf") return "font/otf";
    if (ext == ".wasm") return "application/wasm";
    if (ext == ".xml") return "application/xml; charset=utf-8";
    if (ext == ".map" || ext == ".webmanifest") return "application/json; charset=utf-8";
    if (ext == ".pdf") return "application/pdf";
    if (ext == ".txt") return "text/plain; charset=utf-8";
    return "application/octet-stream";
}

bool fileExists(const std::string& path) {
    DWORD a = GetFileAttributesA(path.c_str());
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

bool isDirectory(const std::string& path) {
    DWORD a = GetFileAttributesA(path.c_str());
    return a != INVALID_FILE_ATTRIBUTES && (a & FILE_ATTRIBUTE_DIRECTORY);
}

// True when the request path starts with the mount route; `rest` receives the remaining segments.
bool matchMount(const std::vector<std::string>& seg, const char* route, std::vector<std::string>& rest) {
    std::vector<std::string> prefix = splitPath(route);
    if (seg.size() < prefix.size()) return false;
    for (size_t i = 0; i < prefix.size(); ++i) if (seg[i] != prefix[i]) return false;
    rest.assign(seg.begin() + prefix.size(), seg.end());
    return true;
}

// Resolves a request below a mount to a file; false when the file does not exist.
bool resolveFile(const char* dir, const std::vector<std::string>& rest, std::string& full, std::string& rel, bool& bad) {
    bad = false;
    rel.clear();
    for (const std::string& s : rest) {
        if (s == ".." || s == "." || s.find_first_of("\\/:") != std::string::npos) { bad = true; return false; }
        rel += (rel.empty() ? "" : "/") + s;
    }
    auto build = [&](const std::string& r) {
        std::string p = exeDir() + "\\" + dir + (r.empty() ? "" : "\\" + r);
        for (char& c : p) if (c == '/') c = '\\';
        return p;
    };
    full = build(rel);
    if (isDirectory(full)) { rel += (rel.empty() ? "" : "/") + std::string("index.html"); full = build(rel); }
    return fileExists(full);
}

Response fileResponse(const std::string& full, const std::string& rel) {
    Response r;
    std::ifstream f(full, std::ios::binary);
    if (!f) return errorResponse(404, "file not found: " + rel);
    r.contentType = mimeType(rel);
    std::ostringstream ss;
    ss << f.rdbuf();
    r.body = ss.str();
    return r;
}

Response redirectTo(const std::string& location) {
    Response r;
    r.status = 302;
    r.location = location;
    r.contentType = "text/plain; charset=utf-8";
    return r;
}

// Serves the custom website and the simple API page; false when the path belongs to neither.
bool routeStatic(const Request& req, const std::vector<std::string>& seg, Response& out) {
    const GeneratedApi& api = generatedApi();
    const struct { const char* route; const char* dir; } mounts[] = {
        { api.customRoute, api.customDir },
        { api.webRoute, api.webDir },
    };
    const std::string q = req.query.empty() ? "" : "?" + req.query;
    for (const auto& m : mounts) {
        std::vector<std::string> rest;
        if (!matchMount(seg, m.route, rest)) continue;
        if (std::string(m.route) != "/" && rest.empty() && req.path.back() != '/') {
            // the pages use relative URLs, so the mount root needs its trailing slash
            if (!fileExists(exeDir() + "\\" + m.dir + "\\index.html")) continue;
            out = redirectTo(std::string(m.route) + "/" + q);
            return true;
        }
        std::string full, rel;
        bool bad;
        if (resolveFile(m.dir, rest, full, rel, bad)) { out = fileResponse(full, rel); return true; }
        if (bad) { out = errorResponse(400, "invalid path"); return true; }
    }
    if (seg.empty()) {
        // root: send the visitor to the custom website, else to the simple API page
        for (const auto& m : mounts)
            if (fileExists(exeDir() + "\\" + m.dir + "\\index.html")) { out = redirectTo(std::string(m.route) + "/" + q); return true; }
        out.contentType = "text/html; charset=utf-8";
        out.body = "<h1>Simulator API</h1><p>No web UI found. Use <a href=\"/api/schema\">/api/schema</a>, <code>/api/state</code> or the WebSocket <code>/ws</code>.</p>";
        return true;
    }
    return false;
}

bool authorized(const Request& req) {
    const char* token = generatedApi().token;
    if (!token || !*token) return true;
    auto p = req.params.find("token");
    if (p != req.params.end() && p->second == token) return true;
    auto a = req.headers.find("authorization");
    return a != req.headers.end() && a->second == std::string("Bearer ") + token;
}

Response route(const Request& req) {
    std::vector<std::string> seg = splitPath(req.path);
    // Static files first (custom website, simple API page): a request only reaches the REST
    // API when no served file matches, so /api/health keeps working even if the simple page lives at /api.
    if (req.method == "GET" || req.method == "HEAD") {
        Response r;
        if (routeStatic(req, seg, r)) return r;
    }
    if (!seg.empty() && seg[0] == "api") {
        if (!authorized(req)) return errorResponse(401, "missing or invalid token");
        return routeApi(req, seg);
    }
    if (req.method != "GET" && req.method != "HEAD") return errorResponse(405, "method not allowed");
    return errorResponse(404, "file not found: " + req.path);
}

// ============================================================================
// WebSocket
// ============================================================================

void wsReply(WsClient& c, const Json& reqId, Json body) {
    Json msg = Json::object();
    msg.set("type", Json::string("result"));
    if (!reqId.isNull()) msg.set("reqId", reqId);
    for (size_t i = 0; i < body.size(); ++i) msg.set(body.keys()[i], body.values()[i]);
    sendFrame(c, 0x1, msg.dump());
}

Json wsError(int status, const std::string& message) {
    Json b = Json::object();
    b.set("ok", Json::boolean(false));
    b.set("status", Json::number(status));
    b.set("error", Json::string(message));
    return b;
}

void handleWsMessage(const std::shared_ptr<WsClient>& c, const std::string& text) {
    Json msg;
    std::string err;
    if (!Json::parse(text, msg, err) || !msg.isObject()) { wsReply(*c, Json(), wsError(400, "invalid JSON message: " + err)); return; }
    const Json* idp = msg.find("reqId");
    Json reqId = idp ? *idp : Json();
    const Json* opp = msg.find("op");
    std::string op = opp && opp->isString() ? opp->asString() : "";
    auto str = [&](const char* k) { const Json* v = msg.find(k); return v && v->isString() ? v->asString() : std::string(); };

    if (op == "set") {
        if (const Json* changes = msg.find("changes")) {
            int status;
            wsReply(*c, reqId, applyChanges(*changes, status));
        } else {
            const Json* v = msg.find("value");
            const Json* idx = msg.find("index");
            if (!v || str("attr").empty()) { wsReply(*c, reqId, wsError(400, "'set' needs {instance, attr, value} or {changes}")); return; }
            Result r = setAttribute(str("instance"), str("attr"), *v, idx && idx->isNumber() ? (int)idx->asNumber() : -1);
            if (!r.ok) { wsReply(*c, reqId, wsError(r.status, r.error)); }
            else {
                Json b = Json::object();
                b.set("ok", Json::boolean(true));
                b.set("instance", Json::string(r.instance));
                b.set("attr", Json::string(str("attr")));
                b.set("value", r.value);
                wsReply(*c, reqId, b);
            }
        }
        flushNow();
    } else if (op == "event") {
        const Json* args = msg.find("args");
        Result r = sendEvent(str("instance"), str("name"), args ? *args : Json());
        if (!r.ok) { wsReply(*c, reqId, wsError(r.status, r.error)); return; }
        wsReply(*c, reqId, eventReply(r));
        broadcastEvent(r.instance, str("name"), args ? *args : Json());
        flushNow();
    } else if (op == "snapshot") {
        Hub& h = hub();
        std::lock_guard<std::mutex> lock(h.mutex);
        std::string d = tickLocked();
        if (!d.empty()) broadcastLocked(d);
        sendFrame(*c, 0x1, snapshotLocked());
    } else if (op == "schema") {
        const GeneratedApi& api = generatedApi();
        sendFrame(*c, 0x1, "{\"type\":\"schema\"" + std::string(reqId.isNull() ? "" : ",\"reqId\":" + reqId.dump()) + ",\"schema\":" + std::string(api.schema, api.schemaLength) + "}");
    } else if (op == "reset") {
        if (!scheduleReset()) { wsReply(*c, reqId, wsError(409, "a reset is already in progress")); return; }
        Json b = Json::object();
        b.set("ok", Json::boolean(true));
        b.set("restarting", Json::boolean(true));
        wsReply(*c, reqId, b);
    } else if (op == "ping") {
        Json b = Json::object();
        b.set("ok", Json::boolean(true));
        b.set("pong", Json::number((double)nowMs()));
        wsReply(*c, reqId, b);
    } else {
        wsReply(*c, reqId, wsError(400, "unknown op '" + op + "' (expected set, event, reset, snapshot, schema, ping)"));
    }
}

void wsLoop(const std::shared_ptr<WsClient>& c) {
    std::string message;
    for (;;) {
        unsigned char h[2];
        if (!recvExact(c->sock, (char*)h, 2)) break;
        bool fin = (h[0] & 0x80) != 0;
        int op = h[0] & 0x0F;
        bool masked = (h[1] & 0x80) != 0;
        uint64_t len = h[1] & 0x7F;
        if (len == 126) {
            unsigned char e[2];
            if (!recvExact(c->sock, (char*)e, 2)) break;
            len = ((uint64_t)e[0] << 8) | e[1];
        } else if (len == 127) {
            unsigned char e[8];
            if (!recvExact(c->sock, (char*)e, 8)) break;
            len = 0;
            for (int i = 0; i < 8; ++i) len = (len << 8) | e[i];
        }
        if (len > (1u << 20)) break;
        unsigned char mask[4] = {0, 0, 0, 0};
        if (masked && !recvExact(c->sock, (char*)mask, 4)) break;
        std::string payload((size_t)len, '\0');
        if (len && !recvExact(c->sock, &payload[0], (size_t)len)) break;
        if (masked) for (size_t i = 0; i < payload.size(); ++i) payload[i] ^= (char)mask[i & 3];

        if (op == 0x8) { sendFrame(*c, 0x8, payload.substr(0, 2)); break; }
        if (op == 0x9) { sendFrame(*c, 0xA, payload); continue; }
        if (op == 0xA) continue;
        if (op == 0x1) message.clear();
        else if (op != 0x0) continue;
        message += payload;
        if (message.size() > (1u << 20)) break;
        if (fin) { handleWsMessage(c, message); message.clear(); }
    }
}

bool upgradeToWebSocket(SOCKET s, const Request& req) {
    auto key = req.headers.find("sec-websocket-key");
    if (key == req.headers.end()) return false;
    std::string accept = base64(sha1(key->second + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"));
    std::string resp = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n";
    return sendAll(s, resp.data(), resp.size());
}

void handleConnection(SOCKET s) {
    const GeneratedApi& api = generatedApi();
    DWORD timeout = 60000;
    setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeout, sizeof(timeout));
    DWORD sendTimeout = 2000;
    setsockopt(s, SOL_SOCKET, SO_SNDTIMEO, (const char*)&sendTimeout, sizeof(sendTimeout));
    BOOL nodelay = TRUE;
    setsockopt(s, IPPROTO_TCP, TCP_NODELAY, (const char*)&nodelay, sizeof(nodelay));

    std::string buf;
    for (;;) {
        Request req;
        int err = 0;
        if (!readRequest(s, buf, req, err)) {
            if (err) sendResponse(s, errorResponse(err, "bad request"), false, api.cors);
            break;
        }
        auto up = req.headers.find("upgrade");
        if (up != req.headers.end() && lower(up->second) == "websocket") {
            if (!authorized(req)) { sendResponse(s, errorResponse(401, "missing or invalid token"), false, api.cors); break; }
            if (!upgradeToWebSocket(s, req)) { sendResponse(s, errorResponse(400, "invalid WebSocket handshake"), false, api.cors); break; }
            DWORD none = 0;
            setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&none, sizeof(none));
            auto client = std::make_shared<WsClient>();
            client->sock = s;
            {
                Hub& h = hub();
                std::lock_guard<std::mutex> lock(h.mutex);
                std::string d = tickLocked();
                if (!d.empty()) broadcastLocked(d);
                sendFrame(*client, 0x1, snapshotLocked());
                h.clients.push_back(client);
            }
            wsLoop(client);
            client->alive = false;
            {
                Hub& h = hub();
                std::lock_guard<std::mutex> lock(h.mutex);
                h.clients.erase(std::remove(h.clients.begin(), h.clients.end(), client), h.clients.end());
            }
            break;
        }
        Response resp;
        if (req.method == "OPTIONS") resp.status = 204;
        else resp = route(req);
        auto conn = req.headers.find("connection");
        bool keepAlive = conn == req.headers.end() || lower(conn->second) != "close";
        if (req.method == "HEAD") resp.body.clear();
        sendResponse(s, resp, keepAlive, api.cors);
        if (!keepAlive) break;
    }
    closesocket(s);
}

// ============================================================================
// Server startup
// ============================================================================

void acceptLoop(SOCKET listener) {
    for (;;) {
        SOCKET s = accept(listener, nullptr, nullptr);
        if (s == INVALID_SOCKET) {
            std::this_thread::sleep_for(std::chrono::milliseconds(50));
            continue;
        }
        std::thread([s]() { handleConnection(s); }).detach();
    }
}

void startServer() {
    // Started by a reset: wait for the previous process to release the port.
    if (const char* w = std::getenv("RHAPSODY_API_WAIT_PID")) {
        if (HANDLE h = OpenProcess(SYNCHRONIZE, FALSE, (DWORD)std::atoi(w))) {
            WaitForSingleObject(h, 15000);
            CloseHandle(h);
        }
        SetEnvironmentVariableW(L"RHAPSODY_API_WAIT_PID", nullptr);
    }
    const GeneratedApi& api = generatedApi();
    std::string host = api.host;
    int port = api.port;
    if (const char* e = std::getenv("RHAPSODY_API_HOST")) host = e;
    if (const char* e = std::getenv("RHAPSODY_API_PORT")) port = std::atoi(e);
    for (int i = 1; i < __argc; ++i) {
        if (std::strncmp(__argv[i], "--api-port=", 11) == 0) port = std::atoi(__argv[i] + 11);
        else if (std::strncmp(__argv[i], "--api-host=", 11) == 0) host = __argv[i] + 11;
    }
    const char* disable = std::getenv("RHAPSODY_API_DISABLE");
    if (port <= 0 || (disable && *disable == '1')) {
        std::printf("[API] disabled\n");
        return;
    }

    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) { std::printf("[API] ERROR: WSAStartup failed\n"); return; }
    SOCKET listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    BOOL exclusive = TRUE;
    setsockopt(listener, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (const char*)&exclusive, sizeof(exclusive));
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons((u_short)port);
    if (inet_pton(AF_INET, host == "localhost" ? "127.0.0.1" : host.c_str(), &addr.sin_addr) != 1) {
        std::printf("[API] ERROR: invalid host '%s'\n", host.c_str());
        return;
    }
    if (bind(listener, (sockaddr*)&addr, sizeof(addr)) != 0 || listen(listener, 64) != 0) {
        std::printf("[API] ERROR: cannot listen on %s:%d (winsock error %d) - API disabled\n", host.c_str(), port, WSAGetLastError());
        closesocket(listener);
        return;
    }
    std::thread(acceptLoop, listener).detach();
    std::thread(broadcasterLoop, api.pushRateHz).detach();
    std::printf("[API] listening on http://%s:%d  (REST /api/*, WebSocket /ws, web UI /)\n", host.c_str(), port);
    std::fflush(stdout);
}

struct Boot {
    Boot() { startServer(); }
};
Boot g_boot;

} // namespace
} // namespace RhapsodyApi
