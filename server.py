import json
import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)
CORS(app)

# Use absolute path so it works on Vercel
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(BASE_DIR, "shoes.json"), "r") as f:
    shoes_data = json.load(f)

products = shoes_data["products"]

# ── Build system prompt ──
def build_system_prompt():
    shop = shoes_data["shop"]
    catalog_text = ""
    for p in products:
        catalog_text += (
            f"ID:{p['id']} | {p['name']} | Brand:{p['brand']} | Category:{p['category']} | "
            f"Price:${p['price']} | Rating:{p['rating']}\n"
        )
    prompt = (
        f'You are a helpful shoe store chatbot for "{shop["name"]}".\n\n'
        f'CATALOG:\n{catalog_text}\n'
        'INSTRUCTIONS:\n'
        '- Answer questions about shoes using the catalog above.\n'
        '- When asked to show/list products, mention their IDs like: [ID:1] [ID:8]\n'
        '- Keep replies short, friendly, use emojis.\n'
        '- Do not make up products.\n'
    )
    return prompt.encode('utf-8', errors='ignore').decode('utf-8')

SYSTEM_PROMPT = build_system_prompt()

# ── Smart product injection ──
# Scans the bot reply text and finds mentioned product IDs or matching names/brands/categories
def extract_product_ids(text, user_message):
    ids = []

    # 1. Explicit [ID:X] tags in reply
    ids += [int(x) for x in re.findall(r'\[ID:(\d+)\]', text)]

    # 2. Match by product name mentioned in reply
    for p in products:
        if p['name'].lower() in text.lower() and p['id'] not in ids:
            ids.append(p['id'])

    # 3. If no IDs found yet, search by user query keywords
    if not ids:
        q = user_message.lower()
        for p in products:
            if (p['category'].lower() in q or
                p['brand'].lower() in q or
                p['name'].lower() in q):
                ids.append(p['id'])

    # Deduplicate and limit to 6
    seen = []
    for i in ids:
        if i not in seen:
            seen.append(i)
    return seen[:6]

# ── Clean reply text (remove [ID:X] tags) ──
def clean_text(text):
    return re.sub(r'\[ID:\d+\]', '', text).strip()

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message", "").encode('utf-8', errors='ignore').decode('utf-8')
    history = data.get("history", [])

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history[-6:]:
        messages.append({
            "role": "user" if msg["type"] == "outgoing" else "assistant",
            "content": msg["text"]
        })
    messages.append({"role": "user", "content": user_message})

    try:
        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=os.environ.get("NVIDIA_API_KEY", "")
        )
        completion = client.chat.completions.create(
            model="nvidia/nemotron-3-super-120b-a12b",
            messages=messages,
            temperature=0.6,
            top_p=0.9,
            max_tokens=300,
            stream=True
        )

        reply = ""
        for chunk in completion:
            if not chunk.choices:
                continue
            if chunk.choices[0].delta.content is not None:
                reply += chunk.choices[0].delta.content

        # Strip thinking/reasoning block
        # Handle <think>...</think> tags
        if '</think>' in reply:
            reply = reply.split('</think>')[-1].strip()
        elif '<think>' in reply:
            reply = reply.split('<think>')[0].strip()
        
        # Handle raw reasoning without tags:
        # Reasoning paragraphs are long analytical text.
        # The actual answer is always the LAST short paragraph.
        paragraphs = [p.strip() for p in reply.strip().split('\n\n') if p.strip()]
        if len(paragraphs) > 1:
            # Take only the last paragraph as the real reply
            reply = paragraphs[-1]
        
        reply = reply.strip()

        # Build structured response
        product_ids = extract_product_ids(reply, user_message)
        clean_reply = clean_text(reply)

        actions = []
        if product_ids:
            actions.append({"type": "product_list", "products": product_ids})
        actions.append({
            "type": "quick_replies",
            "buttons": ["Browse Catalog", "Main Menu"]
        })

        return jsonify({"text": clean_reply, "actions": actions})

    except Exception as e:
        print(f"ERROR: {e}", flush=True)
        import traceback; traceback.print_exc()
        return jsonify({
            "type": "bot_response",
            "actions": [
                {"type": "text", "content": "Sorry, having trouble right now. Please try again!"},
                {"type": "quick_replies", "buttons": ["Browse Catalog", "Main Menu"]}
            ]
        }), 200


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "shop": shoes_data["shop"]["name"]})


if __name__ == "__main__":
    print("StepStyle Shoes Bot running on http://localhost:5000")
    print("Loaded", len(products), "products")
    app.run(debug=True, port=5000)
