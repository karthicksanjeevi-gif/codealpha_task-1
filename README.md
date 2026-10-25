# Language Translation Tool

Flask web app: enter text, pick source and target languages, get the translation.
Supports Google Translate API, Microsoft Translator, or the free MyMemory API (default, no key needed).
Includes a Copy button and Listen (text-to-speech) button.

## Run
1. Install Python 3.9+
2. `python -m venv venv`
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
3. `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` (optional for MyMemory; required for Google/Microsoft)
5. `python app.py`
6. Open http://127.0.0.1:5000

## Switching API
Edit `.env`:
- `TRANSLATION_PROVIDER=google` and set `GOOGLE_API_KEY`
- `TRANSLATION_PROVIDER=microsoft` and set `MS_TRANSLATOR_KEY` and `MS_TRANSLATOR_REGION`
Restart the app after changing `.env`.

## Structure
- app.py: Flask server and API calls (keys stay on the server)
- templates/index.html: UI
- static/style.css, static/script.js: styling and front-end logic
