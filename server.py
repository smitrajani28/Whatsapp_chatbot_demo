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
            max_tokens=400,
            stream=True,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}}
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
        # Handle raw reasoning (lines starting with analysis patterns)
        # Find the last paragraph that looks like a real reply (short, has emoji or direct answer)
        lines = reply.strip().split('\n')
        # Find where reasoning ends - look for a short conclusive line
        clean_lines = []
        found_answer = False
        for i, line in enumerate(reversed(lines)):
            line = line.strip()
            if not line:
                continue
            # Reasoning lines are usually long and analytical
            # Real reply lines are short and friendly
            if len(line) < 300:
                clean_lines.insert(0, line)
                if len(clean_lines) >= 3:
                    break
        reply = ' '.join(clean_lines).strip() if clean_lines else reply.strip()

        # Build structured response
        product_ids = extract_product_ids(reply, user_message)
        clean_reply = clean_text(reply)

        actions = [{"type": "text", "content": clean_reply}]

        if product_ids:
            actions.append({"type": "product_list", "products": product_ids})

        actions.append({
            "type": "quick_replies",
            "buttons": ["Browse Catalog", "View Cart", "Main Menu"]
        })

        return jsonify({"type": "bot_response", "actions": actions})

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
