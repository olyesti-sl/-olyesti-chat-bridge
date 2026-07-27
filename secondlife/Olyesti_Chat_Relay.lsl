// Place this script in one object. It relays nearby public chat (channel 0)
// and says approved web messages on channel 0. Set URL and SECRET below.
string URL = "https://chat.olyesti.com";
string SECRET = "replace-with-the-same-bridge-secret";
integer listenHandle;

// llList2Json treats JSON-looking strings specially; quote user chat first.
string jsonString(string value) {
    return llGetSubString(llList2Json(JSON_OBJECT, [value, ""]), 1, -5);
}
sendIncoming(string speaker, string text) {
    string payload = llList2Json(JSON_OBJECT, ["speaker", jsonString(speaker), "text", jsonString(text), "relay", jsonString("Olyesti")]);
    llHTTPRequest(URL + "/api/secondlife/incoming", [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json", HTTP_CUSTOM_HEADER, "X-olyesti-secret", SECRET], payload);
}
poll() {
    llHTTPRequest(URL + "/api/secondlife/outgoing", [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json", HTTP_CUSTOM_HEADER, "X-olyesti-secret", SECRET], "{}");
}
default {
    state_entry() { listenHandle = llListen(0, "", NULL_KEY, ""); llSetTimerEvent(4.0); }
    listen(integer channel, string name, key id, string text) {
        // Do not echo messages spoken by this relay object.
        if (id != llGetKey() && llStringLength(text) > 0) sendIncoming(name, text);
    }
    timer() { poll(); }
    http_response(key request, integer status, list metadata, string content) {
        if (status == 200) {
            integer i;
            for (i = 0; i < 10; ++i) {
                string speaker = llJsonGetValue(content, ["messages", i, "speaker"]);
                string text = llJsonGetValue(content, ["messages", i, "text"]);
                if (speaker == JSON_INVALID || text == JSON_INVALID) return;
                llSay(0, "[Web] " + speaker + ": " + text);
            }
        }
    }
}
