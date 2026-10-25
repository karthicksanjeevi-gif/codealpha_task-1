import os
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()
app = Flask(__name__)

PROVIDER = os.getenv("TRANSLATION_PROVIDER", "mymemory").lower()
MAX_CHARS = 500 if PROVIDER == "mymemory" else 5000

LANGUAGES = {
    "en": "English", "ta": "Tamil", "hi": "Hindi", "te": "Telugu",
    "ml": "Malayalam", "kn": "Kannada", "bn": "Bengali", "es": "Spanish",
    "fr": "French", "de": "German", "it": "Italian", "pt": "Portuguese",
    "ru": "Russian", "ja": "Japanese", "ko": "Korean",
    "zh-CN": "Chinese (Simplified)", "ar": "Arabic",
}


def translate_google(text, src, tgt):
    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        raise ValueError("GOOGLE_API_KEY is missing in your .env file.")
    body = {"q": text, "target": tgt, "format": "text"}
    if src != "auto":
        body["source"] = src
    r = requests.post(
        "https://translation.googleapis.com/language/translate/v2",
        params={"key": key}, json=body, timeout=15,
    )
    r.raise_for_status()
    item = r.json()["data"]["translations"][0]
    return item["translatedText"], item.get("detectedSourceLanguage")


def translate_microsoft(text, src, tgt):
    key = os.getenv("MS_TRANSLATOR_KEY")
    if not key:
        raise ValueError("MS_TRANSLATOR_KEY is missing in your .env file.")
    fix = lambda c: "zh-Hans" if c == "zh-CN" else c
    params = {"api-version": "3.0", "to": fix(tgt)}
    if src != "auto":
        params["from"] = fix(src)
    headers = {
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": os.getenv("MS_TRANSLATOR_REGION", "global"),
        "Content-Type": "application/json",
    }
    r = requests.post(
        "https://api.cognitive.microsofttranslator.com/translate",
        params=params, headers=headers, json=[{"Text": text}], timeout=15,
    )
    r.raise_for_status()
    item = r.json()[0]
    detected = item.get("detectedLanguage", {}).get("language")
    return item["translations"][0]["text"], detected


def translate_mymemory(text, src, tgt):
    pair = f"{'Autodetect' if src == 'auto' else src}|{tgt}"
    r = requests.get(
        "https://api.mymemory.translated.net/get",
        params={"q": text, "langpair": pair}, timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    if data.get("responseStatus") != 200:
        raise ValueError(data.get("responseDetails", "Translation failed."))
    return data["responseData"]["translatedText"], None


PROVIDERS = {
    "google": translate_google,
    "microsoft": translate_microsoft,
    "mymemory": translate_mymemory,
}


@app.route("/")
def index():
    return render_template("index.html", languages=LANGUAGES,
                           provider=PROVIDER, max_chars=MAX_CHARS)


@app.route("/api/translate", methods=["POST"])
def api_translate():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    src = data.get("source", "auto")
    tgt = data.get("target", "en")

    if not text:
        return jsonify(error="Enter some text to translate."), 400
    if len(text) > MAX_CHARS:
        return jsonify(error=f"Text is too long (max {MAX_CHARS} characters)."), 400
    if tgt not in LANGUAGES or (src != "auto" and src not in LANGUAGES):
        return jsonify(error="Unsupported language selected."), 400
    if PROVIDER not in PROVIDERS:
        return jsonify(error=f"Unknown provider '{PROVIDER}' in .env."), 500

    try:
        translated, detected = PROVIDERS[PROVIDER](text, src, tgt)
    except ValueError as e:
        return jsonify(error=str(e)), 500
    except requests.RequestException as e:
        return jsonify(error=f"Could not reach the translation service: {e}"), 502

    return jsonify(translation=translated, detected=detected)


if __name__ == "__main__":
    app.run(debug=True)
